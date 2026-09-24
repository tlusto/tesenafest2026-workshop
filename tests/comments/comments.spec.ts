import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-005 A comment is added to a task with the text that was entered',
  { tag: ['@TC-005', '@smoke'] },
  async ({ api, testData }) => {
    // Diacritics and symbols as a user would type them. The unique prefix comes first,
    // so the text is recognisable as test data.
    const enteredText = `${uniqueName('comment')} Nezapomeň: zavolat v 15:30 & poslat 2× fakturu!`;

    const task = await test.step('Create a task to comment on', () => testData.createTask());

    const created = await test.step('Add a comment with the text to the task', () =>
      testData.createComment({ task_id: task.id }, { content: enteredText }));

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.comment);
      expect(created.id).not.toBe('');
      expect(created.content).toBe(enteredText);
      expect(created.item_id).toBe(task.id);
    });

    await test.step('Load the comment by its id and check its text', async () => {
      const loaded = await api.comments.get(created.id);
      expect(loaded).toMatchSchema(Schema.comment);
      expect(loaded.id).toBe(created.id);
      expect(loaded.content).toBe(enteredText);
      expect(loaded.item_id).toBe(task.id);
    });

    await test.step('Check the comment is listed under the task', async () => {
      const comments = await api.comments.list({ task_id: task.id });
      for (const comment of comments) {
        expect(comment).toMatchSchema(Schema.comment);
      }
      expect(comments.map(({ id, content }) => ({ id, content }))).toEqual([
        { id: created.id, content: enteredText },
      ]);
    });
  },
);
