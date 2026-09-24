import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';
import { addDays, todayIn } from '../../src/utils/dates';

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

test(
  'TC-003 A new task is created with the due date that was entered',
  { tag: ['@TC-003', '@smoke'] },
  async ({ api, testData, accountTimezone }) => {
    // A week ahead in the account's timezone, not the runner's, so the date is the same
    // calendar day the user would pick in the app.
    const enteredDueDate = addDays(todayIn(accountTimezone), 7);

    const created = await test.step('Create a task with the due date', () =>
      testData.createTask({ due_date: enteredDueDate }));

    await test.step('Check the due date in the create response', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.due?.date).toBe(enteredDueDate);
      expect(created.due?.is_recurring).toBe(false);
    });

    await test.step('Load the task and check its due date', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(created.id);
      expect(loaded.due?.date).toBe(enteredDueDate);
      expect(loaded.due?.is_recurring).toBe(false);
    });
  },
);
