import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notionPage, notionEmbed } from '../src/manual.ts';
test('manual links accept only HTTPS Notion without credentials or deceptive host',()=>{
 for(const url of ['javascript:alert(1)','https://notion.site.evil.test/x','https://user:pass@example.notion.site/x','http://example.notion.site/x','https://example.notion.site:444/x']) assert.equal(notionPage(url),null);
 assert.equal(notionPage('https://example.notion.site/manual'),'https://example.notion.site/manual');
});
test('embedded manual requires exact published host and designated Notion embed path',()=>{
 const page='https://example.notion.site/123456789012345678901234567890abce', embed='https://example.notion.site/ebd/123456789012345678901234567890abce';
 assert.equal(notionEmbed(embed,page),embed);
 for(const invalid of [page,'https://other.notion.site/ebd/123456789012345678901234567890abce','https://example.notion.site/ebd/not-an-id','https://www.notion.so/ebd/123456789012345678901234567890abce']) assert.equal(notionEmbed(invalid,page),null);
});
