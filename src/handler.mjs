import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME;
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });

export const handler = async (event) => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) return json(401, { message: 'Sign in is required.' });
  const method = event.requestContext?.http?.method;
  const id = event.pathParameters?.id;

  try {
    if (method === 'GET') {
      const result = await db.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false,
        Limit: 100,
      }));
      return json(200, { notes: (result.Items ?? []).map(({ noteId, text, createdAt }) => ({ id: noteId, text, createdAt })) });
    }
    if (method === 'POST') {
      let input;
      try { input = JSON.parse(event.body ?? '{}'); } catch { return json(400, { message: 'Request body must be valid JSON.' }); }
      const text = typeof input.text === 'string' ? input.text.trim() : '';
      if (!text || text.length > 500) return json(400, { message: 'A note must contain between 1 and 500 characters.' });
      const item = { userId, noteId: randomUUID(), text, createdAt: new Date().toISOString() };
      await db.send(new PutCommand({ TableName: tableName, Item: item }));
      return json(201, { note: { id: item.noteId, text: item.text, createdAt: item.createdAt } });
    }
    if (method === 'DELETE' && id) {
      const key = { userId, noteId: id };
      const existing = await db.send(new GetCommand({ TableName: tableName, Key: key, ProjectionExpression: 'userId' }));
      if (!existing.Item) return json(404, { message: 'Note not found.' });
      await db.send(new DeleteCommand({ TableName: tableName, Key: key }));
      return json(200, { deleted: true });
    }
    return json(404, { message: 'Route not found.' });
  } catch (error) {
    console.error(JSON.stringify({ message: 'Notes request failed', name: error?.name, requestId: event.requestContext?.requestId }));
    return json(500, { message: 'The request could not be completed.' });
  }
};
