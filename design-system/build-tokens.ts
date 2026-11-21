// Generates tokens.css and tokens.ts from tokens.json.
// Run: node design-system/build-tokens.ts

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type ThemedValue = string | Record<string, string>;

interface Token {
    name: string;
    value: ThemedValue;
    usage?: string;
}

interface TypeStyle {
    name: string;
    fontSize: string;
    lineHeight: string;
    fontWeight: number | string;
    letterSpacing?: string;
    family?: string;
}

interface Tokens {
    name: string;
    color: { themes: { id: string; name: string }[]; tokens: Token[] };
    type: {
        families: Record<string, string>;
        groups: { name: string; family: string; styles: TypeStyle[] }[];
    };
    spacing: { tokens: Token[] };
    radius: { tokens: Token[] };
    shadow: { tokens: Token[] };
}

const dir: string = dirname(fileURLToPath(import.meta.url));
const tokens: Tokens = JSON.parse(readFileSync(join(dir, "tokens.json"), "utf8"));
const themes: string[] = tokens.color.themes.map((t) => t.id);
const firstTheme: string = themes[0];

function valueFor(token: Token, theme: string): string {
    if (typeof token.value === "string") {
        return token.value;
    }
    return token.value[theme] ?? token.value[firstTheme];
}

function cssValue(raw: string): string {
    const alias: RegExpMatchArray | null = raw.match(/^\{(.+)\}$/);
    return alias ? `var(--${alias[1]})` : raw;
}

function themedBlock(theme: string): string[] {
    const lines: string[] = [];
    for (const token of [...tokens.color.tokens, ...tokens.shadow.tokens]) {
        lines.push(`    --${token.name}: ${cssValue(valueFor(token, theme))};`);
    }
    return lines;
}

const css: string[] = [
    `/* ${tokens.name} — generated from tokens.json by build-tokens.ts. Do not edit. */`,
    "",
    `:root, :host, [data-theme="${firstTheme}"], :host([data-theme="${firstTheme}"]) {`,
    `    color-scheme: ${firstTheme};`,
    ...themedBlock(firstTheme),
    "}",
];

for (const theme of themes.slice(1)) {
    css.push("", `[data-theme="${theme}"], :host([data-theme="${theme}"]) {`, `    color-scheme: ${theme};`, ...themedBlock(theme), "}");
}

css.push("", ":root, :host {");
for (const token of [...tokens.spacing.tokens, ...tokens.radius.tokens]) {
    css.push(`    --${token.name}: ${token.value};`);
}
for (const [key, stack] of Object.entries(tokens.type.families)) {
    css.push(`    --font-${key}: ${stack};`);
}
css.push("}");

for (const group of tokens.type.groups) {
    for (const style of group.styles) {
        css.push(
            "",
            `.rd-text-${style.name} {`,
            `    font-family: var(--font-${style.family ?? group.family});`,
            `    font-size: ${style.fontSize};`,
            `    line-height: ${style.lineHeight};`,
            `    font-weight: ${style.fontWeight};`,
        );
        if (style.letterSpacing) {
            css.push(`    letter-spacing: ${style.letterSpacing};`);
        }
        if (style.name === "axis") {
            css.push("    text-transform: uppercase;");
        }
        css.push("}");
    }
}

writeFileSync(join(dir, "tokens.css"), css.join("\n") + "\n");

function camel(name: string): string {
    return name.replace(/^rd-/, "").replace(/-([a-z0-9])/g, (_m: string, c: string) => c.toUpperCase());
}

function varMap(list: Token[]): string[] {
    return list.map((t) => `    ${camel(t.name)}: "var(--${t.name})",`);
}

const ts: string[] = [
    `// ${tokens.name} — generated from tokens.json by build-tokens.ts. Do not edit.`,
    "",
    `export const themes = ${JSON.stringify(themes).replace(/,/g, ", ")} as const;`,
    "export type Theme = (typeof themes)[number];",
    "",
    "export const color = {",
    ...varMap(tokens.color.tokens),
    "} as const;",
    "",
    "export const space = {",
    ...varMap(tokens.spacing.tokens),
    "} as const;",
    "",
    "export const radius = {",
    ...varMap(tokens.radius.tokens),
    "} as const;",
    "",
    "export const shadow = {",
    ...varMap(tokens.shadow.tokens),
    "} as const;",
    "",
    "export const font = {",
    ...Object.keys(tokens.type.families).map((k) => `    ${k}: "var(--font-${k})",`),
    "} as const;",
    "",
    "export const textStyle = {",
    ...tokens.type.groups.flatMap((g) => g.styles.map((s) => `    ${camel(s.name)}: "rd-text-${s.name}",`)),
    "} as const;",
    "",
];

writeFileSync(join(dir, "tokens.ts"), ts.join("\n"));
console.log("Wrote tokens.css and tokens.ts");
