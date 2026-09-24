import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-002 A new task is created with the text that was entered',
  { tag: ['@TC-002', '@smoke'] },
  async ({ api, testData }) => {
    // Diacritics and symbols as a user would type them. The unique prefix comes first,
    // so the global setup can recognise and delete a leftover.
    const enteredText = `${uniqueName('task')} Koupit mléko, chléb a 2× máslo`;

    const created = await test.step('Create a task with the text', () =>
      testData.createTask({ content: enteredText }));

    await test.step('Check the text in the create response', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.content).toBe(enteredText);
    });

    await test.step('Load the task and check its text', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(created.id);
      expect(loaded.content).toBe(enteredText);
    });
  },
);
