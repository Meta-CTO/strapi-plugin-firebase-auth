export default {
  type: 'object',
  properties: {
    serviceAccount: {
      type: 'object',
      required: true,
      properties: {
        projectId: { type: 'string' },
        clientEmail: { type: 'string' },
        privateKey: { type: 'string' },
      },
    },
  },
  required: ['serviceAccount'],
}; 