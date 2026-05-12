import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface ProblemJSON {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [ext: string]: unknown;
}

interface ProblemOpts {
  instance?: string;
  detail?: string;
  extensions?: Record<string, unknown>;
}

export class Problem extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly instance?: string;
  readonly extensions: Record<string, unknown>;

  constructor(
    status: number,
    type: string,
    title: string,
    detail?: string,
    opts: { instance?: string; extensions?: Record<string, unknown> } = {},
  ) {
    super(detail ?? title);
    this.name = 'Problem';
    this.status = status;
    this.type = type;
    this.title = title;
    if (opts.instance !== undefined) this.instance = opts.instance;
    this.extensions = opts.extensions ?? {};
  }

  toJSON(): ProblemJSON {
    const out: ProblemJSON = { type: this.type, title: this.title, status: this.status };
    if (this.message && this.message !== this.title) out.detail = this.message;
    if (this.instance !== undefined) out.instance = this.instance;
    return { ...out, ...this.extensions };
  }
}

const make =
  (status: number, type: string, title: string) =>
  (detail?: string, opts: ProblemOpts = {}) =>
    new Problem(status, type, title, detail ?? opts.detail, {
      instance: opts.instance,
      extensions: opts.extensions,
    });

export const badRequest = make(400, '/problems/bad-request', 'Bad Request');
export const unauthorized = make(401, '/problems/unauthorized', 'Unauthorized');
export const forbidden = make(403, '/problems/forbidden', 'Forbidden');
export const notFound = make(404, '/problems/not-found', 'Not Found');
export const tooManyRequests = make(429, '/problems/too-many-requests', 'Too Many Requests');
export const internal = (detail = 'An unexpected error occurred', opts: ProblemOpts = {}) =>
  new Problem(500, '/problems/internal-server-error', 'Internal Server Error', detail, opts);

const HTTP_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  429: 'Too Many Requests',
};

interface ValidationItem {
  instancePath?: string;
  message?: string;
}

export function problemFromError(err: unknown, requestId: string, instance?: string): Problem {
  if (err instanceof Problem) return err;
  const e = err as FastifyError & { validation?: ValidationItem[]; validationContext?: string };

  if (Array.isArray(e?.validation)) {
    const errors = e.validation.map((v) => ({
      field: `${e.validationContext ?? 'request'}${v.instancePath ?? ''}`,
      message: v.message ?? 'invalid',
    }));
    return new Problem(400, '/problems/bad-request', 'Bad Request', 'Request validation failed', {
      instance,
      extensions: { errors },
    });
  }

  const status = typeof e?.statusCode === 'number' ? e.statusCode : 500;
  if (status >= 500) {
    return new Problem(500, '/problems/internal-server-error', 'Internal Server Error', 'An unexpected error occurred', {
      instance,
      extensions: { requestId },
    });
  }
  const title = HTTP_TITLES[status] ?? 'Error';
  return new Problem(status, `/problems/${title.toLowerCase().replace(/\s+/g, '-')}`, title, e?.message, {
    instance,
  });
}

export function installErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    sendProblem(reply, notFound(`Route ${req.method} ${req.url} not found`, { instance: req.url }));
  });
  app.setErrorHandler((err, req: FastifyRequest, reply: FastifyReply) => {
    const problem = problemFromError(err, req.id, req.url);
    if (problem.status >= 500) req.log.error({ err, reqId: req.id }, 'request failed');
    sendProblem(reply, problem);
  });
}

function sendProblem(reply: FastifyReply, problem: Problem): void {
  reply.code(problem.status).type('application/problem+json').send(problem.toJSON());
}
