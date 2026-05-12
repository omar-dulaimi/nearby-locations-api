// Registers JSON-Schema string formats so `@sinclair/typebox/value`'s Check honours `format: 'uuid' | 'uri'`.
import { FormatRegistry } from '@sinclair/typebox';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URI_RE = /^[a-z][a-z0-9+\-.]*:\/\/[^\s]+$/i;

if (!FormatRegistry.Has('uuid')) FormatRegistry.Set('uuid', (v) => typeof v === 'string' && UUID_RE.test(v));
if (!FormatRegistry.Has('uri')) FormatRegistry.Set('uri', (v) => typeof v === 'string' && URI_RE.test(v));
