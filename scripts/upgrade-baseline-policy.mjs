const RELEASE_VERSION_PATTERN =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;

export function parseReleaseVersion(value) {
  const match = RELEASE_VERSION_PATTERN.exec(value ?? "");
  if (!match?.groups) {
    throw new Error(`Invalid release version: ${String(value)}`);
  }
  return {
    value,
    major: Number(match.groups.major),
    minor: Number(match.groups.minor),
    patch: Number(match.groups.patch),
    prerelease: match.groups.prerelease?.split(".") ?? [],
  };
}

function comparePrereleaseIdentifiers(left, right) {
  const leftNumeric = /^0$|^[1-9]\d*$/u.test(left);
  const rightNumeric = /^0$|^[1-9]\d*$/u.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left.localeCompare(right);
}

export function compareReleaseVersions(leftValue, rightValue) {
  const left = parseReleaseVersion(leftValue);
  const right = parseReleaseVersion(rightValue);
  for (const key of ["major", "minor", "patch"]) {
    const difference = left[key] - right[key];
    if (difference !== 0) return Math.sign(difference);
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0;
    return left.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    const difference = comparePrereleaseIdentifiers(
      leftIdentifier,
      rightIdentifier,
    );
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function stableRelease(version) {
  return parseReleaseVersion(version).prerelease.length === 0;
}

export function baselineInstallerSuffix(target) {
  if (/apple-darwin$/u.test(target)) return ".dmg";
  if (/pc-windows-msvc$/u.test(target)) return ".msi";
  if (/unknown-linux-gnu$/u.test(target)) return ".deb";
  throw new Error(`Unsupported release target: ${target}`);
}

export function selectUpgradeBaseline(
  record,
  { target, currentVersion, baselineTag },
) {
  parseReleaseVersion(currentVersion);
  if (
    typeof baselineTag !== "string" ||
    !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/u.test(baselineTag)
  ) {
    throw new Error("Upgrade baseline tag must be an exact v-prefixed version");
  }
  if (
    !record ||
    !Number.isInteger(record.schemaVersion) ||
    record.schemaVersion < 1 ||
    record.target !== target ||
    typeof record.version !== "string" ||
    baselineTag !== `v${record.version}` ||
    !Array.isArray(record.artifacts)
  ) {
    throw new Error(
      "Upgrade baseline verification record is malformed or for another release",
    );
  }
  if (compareReleaseVersions(record.version, currentVersion) >= 0) {
    throw new Error(
      `Upgrade baseline ${record.version} must be older than ${currentVersion}`,
    );
  }
  if (record.updater?.detachedSignatures !== "cryptographically-verified") {
    throw new Error(
      "Upgrade baseline has no cryptographically verified updater evidence",
    );
  }
  const verification = record.platformVerification;
  const platformEvidenceValid = target.endsWith("apple-darwin")
    ? verification?.codeSignature === "verified" &&
      verification?.gatekeeper === "accepted" &&
      verification?.notarizationTicket === "validated" &&
      verification?.stapling === "validated"
    : target.endsWith("pc-windows-msvc")
      ? verification?.authenticode === "valid" &&
        verification?.timestamp === "present" &&
        verification?.installLifecycle === "verified"
      : verification?.nativePackageSignature === "not-applicable" &&
        verification?.installLifecycle === "verified";
  if (!platformEvidenceValid) {
    throw new Error(
      "Upgrade baseline has no complete platform verification evidence",
    );
  }
  const suffix = baselineInstallerSuffix(target);
  const installers = record.artifacts.filter(
    (artifact) =>
      artifact?.role?.includes("installer") &&
      artifact.path?.endsWith(suffix) &&
      /^[a-f0-9]{64}$/u.test(artifact.sha256 ?? ""),
  );
  if (installers.length !== 1) {
    throw new Error(
      `Upgrade baseline must contain exactly one verified ${suffix} installer`,
    );
  }
  const installer = installers[0];
  const requiresDetachedInstallerSignature = !target.endsWith("apple-darwin");
  const signature = record.artifacts.find(
    (artifact) =>
      ["updater-signature", "installer-signature"].includes(artifact?.role) &&
      artifact.path === `${installer.path}.sig` &&
      /^[a-f0-9]{64}$/u.test(artifact.sha256 ?? ""),
  );
  if (requiresDetachedInstallerSignature && !signature) {
    throw new Error(
      "Upgrade baseline installer has no verified detached signature",
    );
  }
  return {
    tag: baselineTag,
    version: record.version,
    installer,
    signature: signature ?? null,
  };
}

export function validateUpgradeLifecycleEvidence(lifecycle, version) {
  const required = stableRelease(version);
  if (lifecycle?.upgrade === "verified") {
    if (
      typeof lifecycle.baselineVersion !== "string" ||
      compareReleaseVersions(lifecycle.baselineVersion, version) >= 0 ||
      typeof lifecycle.baselineInstallerSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(lifecycle.baselineInstallerSha256) ||
      lifecycle.dataSurvivedUpgrade !== "verified" ||
      lifecycle.healthAfterUpgrade?.status !== "ok" ||
      lifecycle.versionAfterUpgrade !== version
    ) {
      throw new Error("Installer upgrade lifecycle evidence is malformed");
    }
    return "verified";
  }
  if (!required && lifecycle?.upgrade === "not-tested-prerelease") {
    return "not-required-for-prerelease";
  }
  throw new Error(
    required
      ? "Stable release requires a verified upgrade from an older signed installer"
      : "Prerelease lifecycle must explicitly record whether upgrade was tested",
  );
}
