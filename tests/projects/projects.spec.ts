import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-001 A new project is created and comes back under the name that was entered',
  { tag: ['@TC-001', '@smoke'] },
  async ({ api, testData }) => {
    // A name as a user would type it, with Czech diacritics and symbols. The unique prefix comes
    // first, so the global setup can recognise and delete a leftover.
    const name = `${uniqueName('project')} Rekonstrukce kuchyně, řemeslníci & 2× úklid`;

    const created = await test.step('Create a project with a new name', () =>
      testData.createProject({ name }));

    await test.step('Check the name in the create response', () => {
      expect(created).toMatchSchema(Schema.project);
      expect(created.name).toBe(name);
    });

    await test.step('Load the project and check its name', async () => {
      const project = await api.projects.get(created.id);
      expect(project).toMatchSchema(Schema.project);
      expect(project.id).toBe(created.id);
      expect(project.name).toBe(name);
    });
  },
);

test(
  'TC-006 A renamed project loads under the new name the next time it is opened, not only in the response to the update',
  { tag: ['@TC-006', '@regression'] },
  async ({ api, testData }) => {
    const originalName = uniqueName('project');
    const newName = `${uniqueName('project')} Přejmenováno: chata & zahrada 2×`;

    const created = await test.step('Create a project with the original name', () =>
      testData.createProject({ name: originalName }));

    const updated = await test.step('Rename the project', () =>
      api.projects.update(created.id, { name: newName }));

    await test.step('Check the new name in the update response', () => {
      expect(updated).toMatchSchema(Schema.project);
      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe(newName);
    });

    await test.step('Load the project again and check it has the new name', async () => {
      const project = await api.projects.get(created.id);
      expect(project).toMatchSchema(Schema.project);
      expect(project.id).toBe(created.id);
      expect(project.name).toBe(newName);
    });
  },
);
