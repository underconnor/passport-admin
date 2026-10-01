import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDiscordDraft } from '../src/discord.ts';
const fixed = { guildId: '100000000000000001', verificationRoleId: '100000000000000002' };
const draft = { memberRoleId: '100000000000000003', currentSemester: '26-2', semesterRoles: [{ semester: '26-2', roleId: '100000000000000004' }], nicknameEnabled: true };
test('valid distinct roles and explicit optional settings are accepted', () => {
  assert.equal(validateDiscordDraft(draft, fixed), '');
  assert.equal(validateDiscordDraft({ ...draft, memberRoleId: null, currentSemester: null, semesterRoles: [] }, fixed), '');
});
test('reject duplicate semesters, roles, everyone, invalid IDs and missing current-semester mapping', () => {
  for (const invalid of [
    { ...draft, memberRoleId: fixed.guildId }, { ...draft, memberRoleId: fixed.verificationRoleId },
    { ...draft, memberRoleId: '18446744073709551616' }, { ...draft, currentSemester: '26-3' }, { ...draft, currentSemester: '27-1' },
    { ...draft, semesterRoles: [{ semester: '26-2', roleId: draft.memberRoleId }] },
    { ...draft, semesterRoles: [...draft.semesterRoles, { semester: '26-2', roleId: '100000000000000005' }] },
    { ...draft, semesterRoles: [...draft.semesterRoles, { semester: '27-1', roleId: draft.semesterRoles[0].roleId }] },
    { ...draft, semesterRoles: [{ semester: '', roleId: 'abc' }] },
    { ...draft, semesterRoles: Array(41).fill(draft.semesterRoles[0]) },
  ]) assert.notEqual(validateDiscordDraft(invalid, fixed), '');
});
