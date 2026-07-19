import { describe, it, expect } from "vitest";
import { createRouter, exportMatcher, toRouteMatcher } from "../src";

export function createRoutes(paths) {
  return Object.fromEntries(paths.map((path) => [path, { pattern: path }]));
}

describe("Route matcher", function () {
  it("readme example works", () => {
    const router = createRouter({
      routes: {
        "/foo": { m: "foo" },
        "/foo/**": { m: "foo/**", order: "2" },
        "/foo/bar": { m: "foo/bar" },
        "/foo/bar/baz": { m: "foo/bar/baz", order: "4" },
        "/foo/*/baz": { m: "foo/*/baz", order: "3" },
        "/**": { order: "1" },
      },
    });

    const matcher = toRouteMatcher(router);
    const matches = matcher.matchAll("/foo/bar/baz");

    expect(matches).to.toMatchInlineSnapshot(`
      [
        {
          "order": "1",
        },
        {
          "m": "foo/**",
          "order": "2",
        },
        {
          "m": "foo/*/baz",
          "order": "3",
        },
        {
          "m": "foo/bar/baz",
          "order": "4",
        },
      ]
    `);
  });

  const routes = createRoutes([
    "/",
    "/foo",
    "/foo/*",
    "/foo/**",
    "/foo/bar",
    "/foo/baz",
    "/foo/baz/**",
    "/foo/*/sub",
    "/without-trailing",
    "/with-trailing/",
    "/c/**",
    "/cart",
  ]);

  const router = createRouter({ routes });
  const matcher = toRouteMatcher(router);

  const _match = (path) => matcher.matchAll(path).map((r) => r.pattern);

  it("can create route table", () => {
    expect(matcher.ctx.table).to.toMatchInlineSnapshot(`
      {
        "dynamic": Map {
          "/foo" => {
            "dynamic": Map {},
            "static": Map {
              "/sub" => {
                "pattern": "/foo/*/sub",
              },
              "/" => {
                "pattern": "/foo/*",
              },
            },
            "wildcard": Map {},
          },
        },
        "static": Map {
          "/" => {
            "pattern": "/",
          },
          "/foo" => {
            "pattern": "/foo",
          },
          "/foo/bar" => {
            "pattern": "/foo/bar",
          },
          "/foo/baz" => {
            "pattern": "/foo/baz",
          },
          "/without-trailing" => {
            "pattern": "/without-trailing",
          },
          "/with-trailing" => {
            "pattern": "/with-trailing/",
          },
          "/cart" => {
            "pattern": "/cart",
          },
        },
        "wildcard": Map {
          "/foo" => {
            "pattern": "/foo/**",
          },
          "/foo/baz" => {
            "pattern": "/foo/baz/**",
          },
          "/c" => {
            "pattern": "/c/**",
          },
        },
      }
    `);
  });

  it("can match routes", () => {
    expect(_match("/")).to.toMatchInlineSnapshot(`
      [
        "/",
      ]
    `);
    expect(_match("/foo")).to.toMatchInlineSnapshot(`
      [
        "/foo/**",
        "/foo",
      ]
    `);
    expect(_match("/foo/bar")).to.toMatchInlineSnapshot(`
      [
        "/foo/**",
        "/foo/*",
        "/foo/bar",
      ]
    `);
    expect(_match("/foo/baz")).to.toMatchInlineSnapshot(`
      [
        "/foo/**",
        "/foo/baz/**",
        "/foo/*",
        "/foo/baz",
      ]
    `);
    expect(_match("/foo/123/sub")).to.toMatchInlineSnapshot(`
      [
        "/foo/**",
        "/foo/*/sub",
      ]
    `);
    expect(_match("/foo/123")).to.toMatchInlineSnapshot(`
      [
        "/foo/**",
        "/foo/*",
      ]
    `);
  });

  it("trailing slash", () => {
    // Defined with trailing slash
    expect(_match("/with-trailing")).to.toMatchInlineSnapshot(`
      [
        "/with-trailing/",
      ]
    `);
    expect(_match("/with-trailing")).toMatchObject(_match("/with-trailing/"));

    // Defined without trailing slash
    expect(_match("/without-trailing")).to.toMatchInlineSnapshot(`
      [
        "/without-trailing",
      ]
    `);
    expect(_match("/without-trailing")).toMatchObject(
      _match("/without-trailing/"),
    );
  });

  it("prefix overlap", () => {
    expect(_match("/c/123")).to.toMatchInlineSnapshot(`
      [
        "/c/**",
      ]
    `);
    expect(_match("/c/123")).toMatchObject(_match("/c/123/"));
    expect(_match("/c/123")).toMatchObject(_match("/c"));

    expect(_match("/cart")).to.toMatchInlineSnapshot(`
      [
        "/cart",
      ]
    `);
  });

  it("can be exported", () => {
    const jsonData = exportMatcher(matcher);
    expect(jsonData).toMatchInlineSnapshot(`
      {
        "dynamic": {
          "/foo": {
            "dynamic": {},
            "static": {
              "/": {
                "pattern": "/foo/*",
              },
              "/sub": {
                "pattern": "/foo/*/sub",
              },
            },
            "wildcard": {},
          },
        },
        "static": {
          "/": {
            "pattern": "/",
          },
          "/cart": {
            "pattern": "/cart",
          },
          "/foo": {
            "pattern": "/foo",
          },
          "/foo/bar": {
            "pattern": "/foo/bar",
          },
          "/foo/baz": {
            "pattern": "/foo/baz",
          },
          "/with-trailing": {
            "pattern": "/with-trailing/",
          },
          "/without-trailing": {
            "pattern": "/without-trailing",
          },
        },
        "wildcard": {
          "/c": {
            "pattern": "/c/**",
          },
          "/foo": {
            "pattern": "/foo/**",
          },
          "/foo/baz": {
            "pattern": "/foo/baz/**",
          },
        },
      }
    `);
  });
});

/**
 * Regression for nuxt/nuxt#34715.
 *
 * Nuxt (via Nitro 2/radix3) generates payload routeRules by appending
 * `/_payload.json` to cached rules. With i18n `prefix_and_default`, both
 * `/:slug/about` and `/:locale/:slug/about` exist. Registering the longer
 * param pattern corrupts matching for the shorter one.
 */
const matchPatterns = (patterns: string[], path: string): string[] => {
  const matcher = toRouteMatcher(
    createRouter({
      routes: Object.fromEntries(
        patterns.map((pattern) => [pattern, { pattern }]),
      ),
    }),
  );
  return matcher.matchAll(path).map((r) => r.pattern as string);
};

describe("param pattern overlap (nuxt/nuxt#34715)", () => {
  it("matches one-param patterns in isolation", () => {
    expect(matchPatterns(["/:slug/about"], "/travel/about")).toEqual([
      "/:slug/about",
    ]);
    expect(
      matchPatterns(
        ["/:slug/about/_payload.json"],
        "/travel/about/_payload.json",
      ),
    ).toEqual(["/:slug/about/_payload.json"]);
  });

  it("matches two-param patterns in isolation", () => {
    expect(
      matchPatterns(
        ["/:locale/:slug/about/_payload.json"],
        "/en/travel/about/_payload.json",
      ),
    ).toEqual(["/:locale/:slug/about/_payload.json"]);
  });

  it("keeps matching one-param payload when registered with /**", () => {
    expect(
      matchPatterns(
        ["/**", "/:slug/about", "/:slug/about/_payload.json"],
        "/travel/about/_payload.json",
      ),
    ).toEqual(["/**", "/:slug/about/_payload.json"]);
  });

  it("still matches one-param payload when a longer param pattern is also registered", () => {
    expect(
      matchPatterns(
        [
          "/:slug/about/_payload.json",
          "/:locale/:slug/about/_payload.json",
        ],
        "/travel/about/_payload.json",
      ),
    ).toEqual(["/:slug/about/_payload.json"]);
  });

  it("matches Nuxt-style routeRules for both one- and two-param payload URLs", () => {
    const patterns = [
      "/**",
      "/:slug/about",
      "/:slug/about/_payload.json",
      "/:locale/:slug/about",
      "/:locale/:slug/about/_payload.json",
    ];

    expect(matchPatterns(patterns, "/travel/about/_payload.json")).toEqual(
      expect.arrayContaining(["/**", "/:slug/about/_payload.json"]),
    );

    expect(
      matchPatterns(patterns, "/en/travel/about/_payload.json"),
    ).toEqual(
      expect.arrayContaining(["/**", "/:locale/:slug/about/_payload.json"]),
    );
  });
});
