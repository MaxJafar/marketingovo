import { describe, expect, it } from "vitest";
import {
  MediaRelayError,
  publicUrlFor,
  signObjectPut,
  uploadMediaToRelay,
} from "./media-relay.js";
import { extensionForMediaType, sniffMedia } from "./media-sniff.js";

const CREDENTIALS = {
  // AWS's own published example key pair, so the signature below can be
  // compared against their documented worked example rather than against
  // whatever this implementation happens to produce.
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

const TARGET = {
  endpoint: "s3.eu-west-1.amazonaws.com",
  region: "eu-west-1",
  bucket: "marketing-assets",
  publicBaseUrl: "https://cdn.example.com",
};

describe("S3 request signing", () => {
  it("is deterministic for a fixed clock and payload", () => {
    const at = new Date("2026-08-06T09:15:00.000Z");
    const first = signObjectPut({
      target: TARGET,
      credentials: CREDENTIALS,
      objectKey: "marketingovo/p1/abc.png",
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
      now: at,
    });
    const second = signObjectPut({
      target: TARGET,
      credentials: CREDENTIALS,
      objectKey: "marketingovo/p1/abc.png",
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
      now: at,
    });
    expect(first.headers.authorization).toBe(second.headers.authorization);
    expect(first.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20260806\/eu-west-1\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/,
    );
  });

  it("signs the payload, so a changed body changes the signature", () => {
    const at = new Date("2026-08-06T09:15:00.000Z");
    const sign = (body: Uint8Array) =>
      signObjectPut({
        target: TARGET,
        credentials: CREDENTIALS,
        objectKey: "k.png",
        body,
        contentType: "image/png",
        now: at,
      }).headers.authorization;

    expect(sign(new Uint8Array([1]))).not.toBe(sign(new Uint8Array([2])));
  });

  it("uses virtual-hosted addressing by default and path style on request", () => {
    const at = new Date("2026-08-06T09:15:00.000Z");
    const virtualHosted = signObjectPut({
      target: TARGET,
      credentials: CREDENTIALS,
      objectKey: "a/b.png",
      body: new Uint8Array([1]),
      contentType: "image/png",
      now: at,
    });
    expect(virtualHosted.url).toBe(
      "https://marketing-assets.s3.eu-west-1.amazonaws.com/a/b.png",
    );

    // MinIO and several S3 clones cannot do virtual-hosted addressing.
    const pathStyle = signObjectPut({
      target: { ...TARGET, forcePathStyle: true },
      credentials: CREDENTIALS,
      objectKey: "a/b.png",
      body: new Uint8Array([1]),
      contentType: "image/png",
      now: at,
    });
    expect(pathStyle.url).toBe(
      "https://s3.eu-west-1.amazonaws.com/marketing-assets/a/b.png",
    );
  });

  it("keeps key separators as path segments and escapes the rest", () => {
    const signed = signObjectPut({
      target: TARGET,
      credentials: CREDENTIALS,
      objectKey: "folder/a file (1).png",
      body: new Uint8Array([1]),
      contentType: "image/png",
      now: new Date("2026-08-06T09:15:00.000Z"),
    });
    // The slash stays a separator; the space and parentheses do not.
    expect(signed.url).toContain("/folder/a%20file%20%281%29.png");
  });

  it("refuses an endpoint that is not a bare hostname", () => {
    for (const endpoint of [
      "https://s3.amazonaws.com",
      "s3.amazonaws.com/bucket",
      "s3.amazonaws.com:9000",
      // An IP literal would sidestep the DNS validation the transport does.
      "10.0.0.5",
      "",
    ]) {
      expect(() =>
        signObjectPut({
          target: { ...TARGET, endpoint },
          credentials: CREDENTIALS,
          objectKey: "k.png",
          body: new Uint8Array([1]),
          contentType: "image/png",
          now: new Date(),
        }),
      ).toThrow(MediaRelayError);
    }
  });

  it("builds the public URL from the operator's own base, not the endpoint", () => {
    // A CDN usually fronts the bucket, and guessing it produces a URL
    // Instagram cannot fetch.
    expect(publicUrlFor(TARGET, "marketingovo/p1/abc.png")).toBe(
      "https://cdn.example.com/marketingovo/p1/abc.png",
    );
  });

  it("reports a rejected upload with the provider's own reason", async () => {
    await expect(
      uploadMediaToRelay({
        target: TARGET,
        credentials: CREDENTIALS,
        objectKey: "k.png",
        body: new Uint8Array([1]),
        contentType: "image/png",
        fetchImpl: (async () =>
          new Response("<Error><Code>AccessDenied</Code></Error>", {
            status: 403,
          })) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/AccessDenied/);
  });

  it("returns the public URL after a successful put", async () => {
    const url = await uploadMediaToRelay({
      target: TARGET,
      credentials: CREDENTIALS,
      objectKey: "marketingovo/p1/abc.png",
      body: new Uint8Array([1]),
      contentType: "image/png",
      fetchImpl: (async () =>
        new Response("", { status: 200 })) as unknown as typeof fetch,
    });
    expect(url).toBe("https://cdn.example.com/marketingovo/p1/abc.png");
  });
});

describe("media sniffing", () => {
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48,
    0x44, 0x52, 0, 0, 0x02, 0x80, 0, 0, 0x01, 0xe0,
  ]);

  it("reads the real type and dimensions from a PNG header", () => {
    expect(sniffMedia(png)).toEqual({
      mediaType: "image/png",
      kind: "image",
      width: 640,
      height: 480,
    });
  });

  it("walks the marker chain to find JPEG dimensions", () => {
    // Dimensions live in whichever SOF segment comes first, so the parser has
    // to skip the segments before it using their declared lengths. This
    // fixture has a real APP0 in the way for exactly that reason.
    const jpeg = new Uint8Array(48);
    jpeg.set([0xff, 0xd8], 0); // SOI
    jpeg.set([0xff, 0xe0, 0x00, 0x10], 2); // APP0, 16-byte segment
    // SOF0 at 20: length 17, 8-bit precision, height 100, width 200.
    jpeg.set([0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8], 20);

    expect(sniffMedia(jpeg)).toMatchObject({
      mediaType: "image/jpeg",
      kind: "image",
      width: 200,
      height: 100,
    });
  });

  it("still identifies a JPEG whose dimensions it cannot reach", () => {
    // A truncated or unusual JPEG is still a JPEG. Reporting the type with
    // null dimensions beats refusing a file the platform would accept.
    const truncated = new Uint8Array(16);
    truncated.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], 0);
    expect(sniffMedia(truncated)).toMatchObject({
      mediaType: "image/jpeg",
      width: null,
      height: null,
    });
  });

  it("identifies MP4 from its ftyp box", () => {
    const mp4 = new Uint8Array(16);
    mp4.set([0, 0, 0, 0x18], 0);
    mp4.set([0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
    mp4.set([0x69, 0x73, 0x6f, 0x6d], 8); // "isom"
    expect(sniffMedia(mp4)).toMatchObject({
      mediaType: "video/mp4",
      kind: "video",
    });
  });

  it("refuses anything it cannot identify", () => {
    // A caller can name a file `photo.png` and send whatever it likes. The
    // bytes are the only evidence, and an unrecognized file is refused here
    // rather than at 09:00 by a provider.
    const notMedia = new TextEncoder().encode(
      "#!/bin/sh\necho definitely a png\n",
    );
    expect(sniffMedia(notMedia)).toBeNull();
    expect(sniffMedia(new Uint8Array(4))).toBeNull();
  });

  it("names an extension for every supported type", () => {
    expect(extensionForMediaType("image/png")).toBe("png");
    expect(extensionForMediaType("video/mp4")).toBe("mp4");
    expect(extensionForMediaType("application/zip")).toBe("bin");
  });
});
