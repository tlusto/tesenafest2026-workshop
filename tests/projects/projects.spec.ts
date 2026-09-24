import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-001 A new project is created and comes back under the name that was entered',
  { tag: ['@TC-001', '@smoke'] },
  async ({ api, testData }) => {
    // A name as a user would type it, with Czech diacritics and symbols. The unique prefix comes
    // first, so the global setup can recognise and delete a leftover.
    const name = `${buildProject().name} Rekonstrukce kuchyně, řemeslníci & 2× úklid`;

    const created = await test.step('Create a project with a new name', async () => {
      const project = await testData.createProject({ name });
      expect(project).toMatchSchema(Schema.project);
      expect(project.name).toBe(name);
      return project;
    });

    await test.step('Load the project and check its name', async () => {
      const project = await api.projects.get(created.id);
      expect(project).toMatchSchema(Schema.project);
      expect(project.id).toBe(created.id);
      expect(project.name).toBe(name);
    });
  },
);
