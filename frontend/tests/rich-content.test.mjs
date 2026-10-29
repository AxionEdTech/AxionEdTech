// Quick checks for the pure logic behind pictures and tables.
// Run with:  npm test
import test from "node:test";
import assert from "node:assert/strict";
import { autoImageify, separateTables } from "../src/richText.js";
import { escapeCell, rowsToMarkdownTable, tsvToMarkdownTable, jsonEscape } from "../src/tableMarkdown.js";
import { normalizeImageSrc, driveFallbackUrl, isImageLikeUrl } from "../src/driveImage.js";

const eq = (name, got, want) => test(name, () => assert.deepEqual(got, want));


const D = "https://drive.google.com/file/d/1AbC_dEf-123/view?usp=sharing";
const L = "https://lh3.googleusercontent.com/d/1AbC_dEf-123=w1000";

// --- autoImageify: raw Drive links become images in place
eq("bare drive link mid-text", autoImageify(`see ${D} for the circuit`), `see ![](<${D}>) for the circuit`);
eq("link on own line", autoImageify(`Before\n${D}\nAfter`), `Before\n![](<${D}>)\nAfter`);
eq("link at very start", autoImageify(D), `![](<${D}>)`);
eq("open?id= form", autoImageify("x https://drive.google.com/open?id=ABC123 y"), "x ![](<https://drive.google.com/open?id=ABC123>) y");
eq("uc?export=view form", autoImageify("x https://drive.google.com/uc?export=view&id=ABC123 y"), "x ![](<https://drive.google.com/uc?export=view&id=ABC123>) y");
eq("trailing period kept outside", autoImageify(`Look at ${D}.`), `Look at ![](<${D}>).`);
eq("trailing paren kept outside", autoImageify(`(see ${D})`), `(see ![](<${D}>))`);
eq("plain .png link", autoImageify("a https://x.com/p/q.png b"), "a ![](<https://x.com/p/q.png>) b");
eq("png with query", autoImageify("a https://x.com/q.JPG?w=2 b"), "a ![](<https://x.com/q.JPG?w=2>) b");
eq("direct lh3 link", autoImageify(`a ${L} b`), `a ![](<${L}>) b`);
eq("two links same line", autoImageify(`${D} ${D}`), `![](<${D}>) ![](<${D}>)`);
// --- must NOT touch
eq("existing md image untouched", autoImageify(`![fig](${D})`), `![fig](${D})`);
eq("existing md link untouched", autoImageify(`[PDF](${D})`), `[PDF](${D})`);
eq("link w/ space after paren untouched", autoImageify(`[PDF]( ${D})`), `[PDF]( ${D})`);
eq("angle autolink untouched", autoImageify(`<${D}>`), `<${D}>`);
eq("ordinary web page untouched", autoImageify("read https://example.com/page now"), "read https://example.com/page now");
eq("youtube untouched", autoImageify("https://youtu.be/dQw4w9WgXcQ"), "https://youtu.be/dQw4w9WgXcQ");
eq("drive folder untouched", autoImageify("https://drive.google.com/drive/folders/1AbC?usp=sharing"), "https://drive.google.com/drive/folders/1AbC?usp=sharing");
eq("google doc untouched", autoImageify("https://docs.google.com/document/d/1AbC/edit"), "https://docs.google.com/document/d/1AbC/edit");
eq("inline code untouched", autoImageify(`use \`${D}\` literally`), `use \`${D}\` literally`);
eq("fenced code untouched", autoImageify("```\n" + D + "\n```"), "```\n" + D + "\n```");
// --- in table cells
eq("table cell with spaces", autoImageify(`| a | ${D} |`), `| a | ![](<${D}>) |`);
eq("table cell no spaces", autoImageify(`|a|${D}|`), `|a|![](<${D}>)|`);
// --- empty
eq("empty", autoImageify(""), ""); eq("undefined", autoImageify(undefined), undefined);

// --- driveImage helpers
eq("normalize share link", normalizeImageSrc(D), L);
eq("normalize leaves other", normalizeImageSrc("https://x.com/a.png"), "https://x.com/a.png");
eq("fallback from share link", driveFallbackUrl(D), "https://drive.google.com/thumbnail?id=1AbC_dEf-123&sz=w1000");
eq("fallback from lh3 link", driveFallbackUrl(L), "https://drive.google.com/thumbnail?id=1AbC_dEf-123&sz=w1000");
eq("fallback none for other", driveFallbackUrl("https://x.com/a.png"), null);
eq("isImageLike garbage", isImageLikeUrl("not a url"), false);

// --- tables
eq("escape pipe", escapeCell("a|b"), "a\\|b");
eq("escape math pipe", escapeCell("$|\\psi\\rangle$ and a|b"), "$\\vert \\psi\\rangle$ and a\\|b");
eq("escape newline", escapeCell("l1\nl2"), "l1<br>l2");
eq("table shape", rowsToMarkdownTable([["Name","Unit"],["Capacitance","Farad"]]), "| Name        | Unit  |\n| ----------- | ----- |\n| Capacitance | Farad |");
eq("tsv excel", tsvToMarkdownTable("Name\tUnit\nC\tF\n"), "| Name | Unit |\n| ---- | ---- |\n| C    | F    |");
eq("tsv quoted newline", tsvToMarkdownTable('A\tB\n"x\ny"\tz'), "| A      | B   |\n| ------ | --- |\n| x<br>y | z   |");
eq("tsv single row -> null", tsvToMarkdownTable("a\tb"), null);
eq("tsv ragged -> null", tsvToMarkdownTable("a\tb\nc"), null);
eq("indented code -> null", tsvToMarkdownTable("\tfoo\n\tbar"), null);
eq("plain prose -> null", tsvToMarkdownTable("hello world\nsecond line"), null);
eq("json escape", jsonEscape('| a |\n"q"'), '| a |\\n\\"q\\"');


// --- separateTables
const T = "| a | b |\n| --- | --- |\n| 1 | 2 |";
eq("blank added after table", separateTables(`${T}\nNext sentence`), `${T}\n\nNext sentence`);
eq("blank added before table", separateTables(`Intro\n${T}`), `Intro\n\n${T}`);
eq("both sides", separateTables(`Intro\n${T}\nOutro`), `Intro\n\n${T}\n\nOutro`);
eq("already separated unchanged", separateTables(`Intro\n\n${T}\n\nOutro`), `Intro\n\n${T}\n\nOutro`);
eq("table only unchanged", separateTables(T), T);
eq("dirac text line left alone", separateTables("|psi> = a|0> + b|1>\nsecond line"), "|psi> = a|0> + b|1>\nsecond line");
eq("no-pipe text fast path", separateTables("just text\nmore text"), "just text\nmore text");
eq("code fence untouched", separateTables("```\n" + T + "\nafter\n```"), "```\n" + T + "\nafter\n```");
eq("two tables back to back", separateTables(`${T}\nmid\n${T}`), `${T}\n\nmid\n\n${T}`);
eq("no leading pipes table", separateTables("x | y\n--|--\n1 | 2\nafter"), "x | y\n--|--\n1 | 2\n\nafter");
eq("hr is not a table", separateTables("a | b\n---\nc"), "a | b\n---\nc");
eq("CRLF normalised", separateTables(`Intro\r\n${T.replace(/\n/g, "\r\n")}\r\nOutro`), `Intro\n\n${T}\n\nOutro`);
