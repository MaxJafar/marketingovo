use crate::manifest::RuntimeSnapshot;
use std::io::{self, Write};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use zeroize::Zeroizing;

#[cfg(unix)]
use std::os::unix::process::CommandExt;

const GRACEFUL_SHUTDOWN: Duration = Duration::from_secs(4);
const REAP_INTERVAL: Duration = Duration::from_millis(25);
const BOOTSTRAP_TICKET_BYTES: usize = 43;

struct ManagedChild {
    child: Child,
    _snapshot: RuntimeSnapshot,
    #[cfg(unix)]
    process_group: i32,
}

#[derive(Default)]
pub struct ChildSupervisor {
    child: Mutex<Option<ManagedChild>>,
}

impl ChildSupervisor {
    pub fn spawn(
        &self,
        command: &mut Command,
        bootstrap_ticket: &str,
        snapshot: RuntimeSnapshot,
    ) -> io::Result<(u32, ChildStdout)> {
        validate_bootstrap_ticket(bootstrap_ticket)?;
        let mut slot = self
            .child
            .lock()
            .map_err(|_| io::Error::other("desktop child lock poisoned"))?;

        if let Some(existing) = slot.as_mut() {
            if existing.child.try_wait()?.is_none() {
                return Err(io::Error::new(
                    io::ErrorKind::AlreadyExists,
                    "the AGENTintel daemon is already running",
                ));
            }
            slot.take();
        }

        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());
        #[cfg(unix)]
        command.process_group(0);

        let mut child = command.spawn()?;
        let pid = child.id();
        let Some(mut stdin) = child.stdin.take() else {
            kill_failed_spawn(&mut child);
            return Err(io::Error::other("daemon stdin was not piped"));
        };
        let Some(stdout) = child.stdout.take() else {
            drop(stdin);
            kill_failed_spawn(&mut child);
            return Err(io::Error::other("daemon stdout was not piped"));
        };

        let mut ticket_line = Zeroizing::new(Vec::with_capacity(BOOTSTRAP_TICKET_BYTES + 1));
        ticket_line.extend_from_slice(bootstrap_ticket.as_bytes());
        ticket_line.push(b'\n');
        if let Err(error) = stdin.write_all(&ticket_line).and_then(|()| stdin.flush()) {
            drop(stdin);
            kill_failed_spawn(&mut child);
            return Err(error);
        }
        drop(stdin);
        drop(ticket_line);

        *slot = Some(ManagedChild {
            child,
            _snapshot: snapshot,
            #[cfg(unix)]
            process_group: pid as i32,
        });
        Ok((pid, stdout))
    }

    pub fn reap_if_exited(&self, pid: u32) {
        let Ok(mut slot) = self.child.lock() else {
            return;
        };
        let should_remove = slot
            .as_mut()
            .filter(|child| child.child.id() == pid)
            .and_then(|child| child.child.try_wait().ok())
            .flatten()
            .is_some();
        if should_remove {
            slot.take();
        }
    }

    pub fn terminate(&self) {
        let managed = self.child.lock().ok().and_then(|mut slot| slot.take());
        if let Some(mut managed) = managed {
            terminate_managed(&mut managed);
        }
    }
}

fn kill_failed_spawn(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

fn validate_bootstrap_ticket(ticket: &str) -> io::Result<()> {
    if ticket.len() != BOOTSTRAP_TICKET_BYTES
        || !ticket
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "desktop bootstrap ticket must be 43 base64url characters",
        ));
    }
    Ok(())
}

impl Drop for ChildSupervisor {
    fn drop(&mut self) {
        let managed = self.child.get_mut().ok().and_then(Option::take);
        if let Some(mut managed) = managed {
            terminate_managed(&mut managed);
        }
    }
}

fn terminate_managed(managed: &mut ManagedChild) {
    if managed.child.try_wait().ok().flatten().is_some() {
        return;
    }

    #[cfg(unix)]
    unsafe {
        // The daemon starts in its own process group. Signalling the group also
        // reaches the Python worker that the Go authority process supervises.
        libc::kill(-managed.process_group, libc::SIGTERM);
    }

    #[cfg(windows)]
    {
        // The Go daemon owns its Python subprocess and watches its parent. The
        // signed daemon is killed here; it must close its worker before exit.
        let _ = managed.child.kill();
    }

    #[cfg(not(any(unix, windows)))]
    let _ = managed.child.kill();

    let deadline = Instant::now() + GRACEFUL_SHUTDOWN;
    while Instant::now() < deadline {
        if managed.child.try_wait().ok().flatten().is_some() {
            return;
        }
        thread::sleep(REAP_INTERVAL);
    }

    #[cfg(unix)]
    unsafe {
        libc::kill(-managed.process_group, libc::SIGKILL);
    }
    let _ = managed.child.kill();
    let _ = managed.child.wait();
}

#[cfg(test)]
mod tests {
    use super::ChildSupervisor;
    use crate::manifest::RuntimeSnapshot;
    use std::io::Read;
    use std::process::Command;

    const TOKEN: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGH012345678";

    #[cfg(unix)]
    #[test]
    fn owns_only_one_daemon_and_reaps_it() {
        let supervisor = ChildSupervisor::default();
        let temporary = tempfile::tempdir().expect("tempdir");
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "IFS= read -r ticket; printf '%s\\n' \"$ticket\""]);
        assert!(command.get_args().all(|argument| argument != TOKEN));
        let snapshot = RuntimeSnapshot::for_test(&temporary.path().join("snapshot-one"));
        let (pid, mut stdout) = supervisor
            .spawn(&mut command, TOKEN, snapshot)
            .expect("spawn");
        let mut delivered = String::new();
        stdout.read_to_string(&mut delivered).expect("stdout");
        assert_eq!(delivered.trim(), TOKEN);

        for _ in 0..50 {
            supervisor.reap_if_exited(pid);
            std::thread::sleep(std::time::Duration::from_millis(5));
        }

        let mut second = Command::new("/bin/sh");
        second.args(["-c", "IFS= read -r ticket; printf 'again\\n'"]);
        let snapshot = RuntimeSnapshot::for_test(&temporary.path().join("snapshot-two"));
        assert!(supervisor.spawn(&mut second, TOKEN, snapshot).is_ok());
        supervisor.terminate();
    }

    #[cfg(unix)]
    #[test]
    fn rejects_invalid_ticket_before_starting_process() {
        let temporary = tempfile::tempdir().expect("tempdir");
        let supervisor = ChildSupervisor::default();
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "exit 99"]);
        let snapshot = RuntimeSnapshot::for_test(&temporary.path().join("snapshot"));
        assert!(supervisor
            .spawn(&mut command, "too-short", snapshot)
            .is_err());
    }
}
