use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use url::Url;
use zeroize::{Zeroize, Zeroizing};

const MAX_PENDING_OUTPUT_BYTES: usize = 64 * 1024;
const TOKEN_BYTES: usize = 32;

pub struct BootstrapToken(Zeroizing<String>);

impl BootstrapToken {
    pub fn generate() -> Self {
        let mut entropy = [0_u8; TOKEN_BYTES];
        OsRng.fill_bytes(&mut entropy);
        let encoded = URL_SAFE_NO_PAD.encode(entropy);
        entropy.zeroize();
        Self(Zeroizing::new(encoded))
    }

    pub fn expose(&self) -> &str {
        self.0.as_str()
    }
}

#[derive(Default)]
pub struct DashboardOutputParser {
    pending: Vec<u8>,
}

impl DashboardOutputParser {
    pub fn push(&mut self, bytes: &[u8]) -> Vec<String> {
        self.pending.extend_from_slice(bytes);
        let mut dashboard_urls = Vec::new();

        while let Some(newline) = self.pending.iter().position(|byte| *byte == b'\n') {
            let mut line = self.pending.drain(..=newline).collect::<Vec<_>>();
            while matches!(line.last(), Some(b'\n' | b'\r')) {
                line.pop();
            }
            let text = String::from_utf8_lossy(&line);
            if let Some(raw_url) = text.trim().strip_prefix("Dashboard: ") {
                dashboard_urls.push(raw_url.trim().to_string());
            }
            line.zeroize();
        }

        if self.pending.len() > MAX_PENDING_OUTPUT_BYTES {
            self.pending.zeroize();
            self.pending.clear();
        }
        dashboard_urls
    }
}

impl Drop for DashboardOutputParser {
    fn drop(&mut self) {
        self.pending.zeroize();
    }
}

pub fn trusted_dashboard_url(raw_url: &str, expected_token: &str) -> Option<Url> {
    if expected_token.len() != 43
        || !expected_token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return None;
    }

    let url = Url::parse(raw_url).ok()?;
    let port = url.port()?;
    let fragment = url.fragment()?;
    let received_token = fragment.strip_prefix("token=")?;

    if url.scheme() != "http"
        || url.host_str() != Some("127.0.0.1")
        || !(1024..=65535).contains(&port)
        || url.path() != "/"
        || url.query().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || received_token != expected_token
    {
        return None;
    }
    Some(url)
}

#[cfg(test)]
mod tests {
    use super::{trusted_dashboard_url, BootstrapToken, DashboardOutputParser};

    const TOKEN: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGH012345678";

    #[test]
    fn generated_tokens_have_fixed_url_safe_entropy() {
        let first = BootstrapToken::generate();
        let second = BootstrapToken::generate();
        assert_eq!(first.expose().len(), 43);
        assert_ne!(first.expose(), second.expose());
        assert!(first
            .expose()
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_')));
    }

    #[test]
    fn parses_a_dashboard_line_split_across_chunks() {
        let mut parser = DashboardOutputParser::default();
        assert!(parser.push(b"booting\nDash").is_empty());
        assert_eq!(
            parser
                .push(format!("board: http://127.0.0.1:3210/#token={TOKEN}\r\nready\n").as_bytes()),
            vec![format!("http://127.0.0.1:3210/#token={TOKEN}")]
        );
    }

    #[test]
    fn accepts_only_the_exact_loopback_fragment_token() {
        assert!(
            trusted_dashboard_url(&format!("http://127.0.0.1:3210/#token={TOKEN}"), TOKEN)
                .is_some()
        );
        assert!(
            trusted_dashboard_url(&format!("https://127.0.0.1:3210/#token={TOKEN}"), TOKEN)
                .is_none()
        );
        assert!(
            trusted_dashboard_url(&format!("http://localhost:3210/#token={TOKEN}"), TOKEN)
                .is_none()
        );
        assert!(
            trusted_dashboard_url(&format!("http://127.0.0.1:3210/?token={TOKEN}"), TOKEN)
                .is_none()
        );
        assert!(trusted_dashboard_url(
            &format!("http://127.0.0.1:3210/#token={}", "Z".repeat(43)),
            TOKEN
        )
        .is_none());
        assert!(
            trusted_dashboard_url(&format!("http://127.0.0.1:80/#token={TOKEN}"), TOKEN).is_none()
        );
    }
}
