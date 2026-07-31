import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '../config/env.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'AeroJudge API',
      version: '1.0.0',
      description:
        'FAI Section 7C compliant air sports competition management API by Nepalabs (AeroJudge). Organizations are first-class tenants that own competitions; branding is configurable per organization and competition.',
    },
    servers: [{ url: `http://localhost:${env.PORT}${env.API_PREFIX}`, description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                page: { type: 'integer' },
                pageSize: { type: 'integer' },
                total: { type: 'integer' },
              },
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
        EnterScoreRequest: {
          type: 'object',
          required: ['flightId'],
          properties: {
            flightId: { type: 'string' },
            distanceCm: { type: 'number', nullable: true },
            resultType: {
              type: 'string',
              enum: ['MEASURED', 'BULLSEYE', 'MAXIMUM', 'DNF', 'ABS', 'DNS', 'DSQ', 'REFLIGHT', 'PENALTY'],
            },
            penaltyCm: { type: 'number' },
            judgeNotes: { type: 'string' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email and password',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
          },
          responses: {
            '200': { description: 'Tokens, user, organizations, requiresOrganizationSelection' },
            '401': { description: 'Invalid credentials' },
          },
        },
      },
      '/auth/select-organization': {
        post: {
          tags: ['Auth'],
          summary: 'Select organization context after login',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Access token bound to organization' } },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token',
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object', properties: { refreshToken: { type: 'string' } } },
              },
            },
          },
          responses: { '200': { description: 'New access token' } },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Revoke refresh token',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Logged out' } },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Current user profile',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'User profile' } },
        },
      },
      '/organizations': {
        get: {
          tags: ['Organizations'],
          summary: 'List organizations',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] } },
          ],
          responses: { '200': { description: 'Paginated organizations' } },
        },
        post: {
          tags: ['Organizations'],
          summary: 'Create organization',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Created' } },
        },
      },
      '/organizations/{id}': {
        get: {
          tags: ['Organizations'],
          summary: 'Get organization by ID',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Organization details' } },
        },
        put: {
          tags: ['Organizations'],
          summary: 'Update organization',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Updated' } },
        },
      },
      '/organizations/{id}/status': {
        patch: {
          tags: ['Organizations'],
          summary: 'Activate, deactivate, or archive organization',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Status updated' } },
        },
      },
      '/organizations/{id}/settings': {
        put: {
          tags: ['Organizations'],
          summary: 'Update organization settings defaults',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Settings updated' } },
        },
      },
      '/organizations/{id}/logo': {
        post: {
          tags: ['Organizations'],
          summary: 'Upload organization logo',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Logo uploaded' } },
        },
      },
      '/organizations/{id}/competitions': {
        get: {
          tags: ['Organizations'],
          summary: 'List competitions for an organization',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Competitions' } },
        },
      },
      '/competitions': {
        get: {
          tags: ['Competitions'],
          summary: 'List competitions',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Paginated competitions' } },
        },
        post: {
          tags: ['Competitions'],
          summary: 'Create competition',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Created' } },
        },
      },
      '/competitions/{id}': {
        get: {
          tags: ['Competitions'],
          summary: 'Get competition by ID',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Competition details' } },
        },
        patch: {
          tags: ['Competitions'],
          summary: 'Update competition',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Updated' } },
        },
      },
      '/competitions/{competitionId}/pilots': {
        get: {
          tags: ['Pilots'],
          summary: 'List pilots',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'competitionId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Pilot list' } },
        },
        post: {
          tags: ['Pilots'],
          summary: 'Register pilot',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Created' } },
        },
      },
      '/competitions/{competitionId}/rounds': {
        get: {
          tags: ['Rounds'],
          summary: 'List rounds',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Rounds' } },
        },
        post: {
          tags: ['Rounds'],
          summary: 'Create round',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Created' } },
        },
      },
      '/competitions/{competitionId}/rounds/{roundId}/start': {
        post: {
          tags: ['Rounds'],
          summary: 'Start round and generate flight order if needed',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Round started' } },
        },
      },
      '/scores/enter': {
        post: {
          tags: ['Scores'],
          summary: 'Enter or update a flight score',
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EnterScoreRequest' } } },
          },
          responses: { '201': { description: 'Score saved and rankings recalculated' } },
        },
      },
      '/competitions/{competitionId}/results/recalculate': {
        post: {
          tags: ['Results'],
          summary: 'Recalculate all rankings via ScoringEngine',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Rankings updated' } },
        },
      },
      '/competitions/{competitionId}/results/rankings/individual': {
        get: {
          tags: ['Results'],
          summary: 'Individual rankings',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string', enum: ['OVERALL', 'WOMEN', 'JUNIOR'] } },
          ],
          responses: { '200': { description: 'Rankings' } },
        },
      },
      '/competitions/{competitionId}/reports/generate': {
        post: {
          tags: ['Reports'],
          summary: 'Generate PDF report',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'PDF archived' } },
        },
      },
      '/public/{slug}/results': {
        get: {
          tags: ['Public'],
          summary: 'Public results by competition slug (no auth)',
          parameters: [
            { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Published results' } },
        },
      },
    },
  },
  apis: [],
};

export const openApiSpec = swaggerJsdoc(options);
