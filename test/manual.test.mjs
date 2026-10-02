import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notionPage, notionEmbed } from '../src/manual.ts';
const id = '123456789012345678901234567890ab';
const page = `https://example.notion.site/${id}`;
test('manual links accept only HTTPS Notion public pages without credentials or deceptive host', () => {
 for (const url of ['javascript:alert(1)', 'https://notion.site.evil.test/x', 'https://user:pass@example.notion.site/x', 'http://example.notion.site/x', 'https://example.notion.site:444/x', 'https://a.b.notion.site/x', `https://example.notion.site/ebd//${id}`, 'https://example.notion.site/manual/child', 'https://example.notion.site/%broken', 'https://example.notion.site/ma\\nual', 'https://example.notion.site/manual\n']) assert.equal(notionPage(url), null, url);
 for (const url of ['https://example.notion.site/manual', 'https://example.notion.site/', `https://www.notion.so/Manual-${id}`, `https://notion.so/${id}`]) assert.equal(notionPage(url), url);
});
test('embedded manual preserves both official slash forms and matches the page ID', () => {
 for (const slash of ['/', '//']) {
  const embed = `https://example.notion.site/ebd${slash}${id}`;
  assert.equal(notionEmbed(embed, page), embed);
  assert.equal(notionEmbed(embed + '/', page), embed + '/');
  assert.equal(notionEmbed(embed + '?v=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', page), embed + '?v=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(notionEmbed(embed, 'https://example.notion.site/manual'), embed);
  assert.equal(notionEmbed(embed, `https://example.notion.site/Manual-${id}`), embed);
 }
 for (const invalid of [page, `https://other.notion.site/ebd/${id}`, 'https://example.notion.site/ebd/not-an-id', `https://www.notion.so/ebd/${id}`, `https://example.notion.site/ebd///${id}`, `https://example.notion.site/ebd//${id}/child`, `https://example.notion.site/ebd//${id}//`, 'https://example.notion.site/ebd//aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'https://example.notion.site/ebd//12345678-9012-3456-7890-123456789abc']) assert.equal(notionEmbed(invalid, page), null, invalid);
 assert.equal(notionEmbed(`https://example.notion.site/ebd//${id}`, 'https://other.notion.site/manual'), null);
});
