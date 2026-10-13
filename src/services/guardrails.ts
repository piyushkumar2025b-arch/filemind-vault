/**
 * FileMind AI Guardrails — client-side safety layer for the chatbot.
 *
 * Runs entirely on-device before any prompt leaves for the AI backend:
 *  - disallowed-intent detection (weapons, self-harm, malware, fraud...)
 *  - prompt-injection / jailbreak attempt detection
 *  - PII & secret detection (cards, API keys, tokens, private keys)
 *
 * The server mirrors the hard rules in functions/api/chat.ts and
 * server/worker.ts so the edge is protected even if the client is bypassed.
 */

export type GuardLevel = 'off' | 'standard' | 'strict';

export interface GuardViolation {
  id: string;
  category: string;
  severity: 'low' | 'high';
  match: string;
}

export interface GuardVerdict {
  allowed: boolean;
  violations: GuardViolation[];
  warnings: string[];
}

interface Rule {
  id: string;
  category: string;
  severity: 'low' | 'high';
  patterns: RegExp[];
}

const HARD_RULES: Rule[] = [
  {
    id: 'weapons',
    category: 'Weapons & explosives',
    severity: 'high',
    patterns: [
      /\bhow\s+to\s+(make|build|assemble|create)\b[^.?]{0,40}\b(bomb|explosive|pipe\s*bomb|ied|detonator|napalm|thermite)/i,
      /\b(synthesi[sz]e|manufacture|produce|cook)\b[^.?]{0,40}\b(nerve\s*agent|sarin|ricin|anthrax|mustard\s*gas|methamphetamine|fentanyl)\b/i,
    ],
  },
  {
    id: 'self-harm',
    category: 'Self-harm',
    severity: 'high',
    patterns: [
      /\bhow\s+to\s+(kill|hang)\s+myself\b/i,
      /\bbest\s+way\s+to\s+(commit\s+suicide|end\s+my\s+life)\b/i,
      /\bself[-\s]?harm\s+(methods|techniques|how)\b/i,
    ],
  },
  {
    id: 'child-safety',
    category: 'Child safety',
    severity: 'high',
    patterns: [
      /\b(child|kid|minor|underage)\b[^.?]{0,30}\b(nude|naked|porn|sexual)\b/i,
    ],
  },
  {
    id: 'malware',
    category: 'Malware & cybercrime',
    severity: 'high',
    patterns: [
      /\b(write|create|generate|give\s+me)\b[^.?]{0,40}\b(keylogger|ransomware|rootkit|infostealer|rat\s+payload)\b/i,
      /\b(bypass|disable|crack)\b[^.?]{0,30}\b(antivirus|2fa|mfa|license\s+check)\b[^.?]{0,20}\b(tool|script|crack)\b/i,
      /\bddos\s+(tool|script|attack)\s+(for|against)\s+(someone|people|a?\s?school|website)/i,
    ],
  },
  {
    id: 'fraud',
    category: 'Fraud & theft',
    severity: 'high',
    patterns: [
      /\bhow\s+to\s+(hack|steal|scam|phish)\b[^.?]{0,40}\b(account|password|credit\s*card|bank|identity|wifi)/i,
      /\bclone\s+(a\s+)?(sim|card|credit\s*card)\b/i,
    ],
  },
  {
    id: 'jailbreak',
    category: 'Prompt injection / jailbreak',
    severity: 'high',
    patterns: [
      /\bignore\s+(all\s+|any\s+|the\s+|your\s+|previous\s+|above\s+)*(instructions?|rules?|prompts?|guardrails?|filters?)\b/i,
      /\byou\s+are\s+now\s+(dan|jailbroken|evil|unfiltered|uncensored)\b/i,
      /\bforget\s+(everything|all|your\s+(rules|instructions|training))\b/i,
      /\b(reveal|print|show|leak|repeat)\s+(me\s+)?(your\s+)?(system\s*prompt|initial\s+instructions|hidden\s+rules)\b/i,
      /\b(pretend|act\s+like|behave)\b[^.?]{0,30}\b(no\s+(rules|restrictions|limits|filters)|without\s+(any\s+)?(rules|restrictions|ethics|limits))\b/i,
    ],
  },
];

interface PIIRule {
  id: string;
  label: string;
  test: (text: string) => string | null;
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const PII_RULES: PIIRule[] = [
  {
    id: 'card',
    label: 'a possible credit card number',
    test: (t) => {
      for (const m of t.match(/\b(?:\d[ -]?){13,19}\b/g) || []) {
        const digits = m.replace(/\D/g, '');
        if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) return m.trim();
      }
      return null;
    },
  },
  { id: 'openai-key', label: 'an OpenAI-style API key', test: (t) => (t.match(/\bsk-[A-Za-z0-9]{20,}/) || [null])[0] },
  { id: 'github-pat', label: 'a GitHub access token', test: (t) => (t.match(/\bgh[pousr]_[A-Za-z0-9]{20,}/) || [null])[0] },
  { id: 'slack-token', label: 'a Slack token', test: (t) => (t.match(/\bxox[baprs]-[A-Za-z0-9-]{10,}/) || [null])[0] },
  { id: 'google-key', label: 'a Google API key', test: (t) => (t.match(/\bAIza[0-9A-Za-z_-]{35}/) || [null])[0] },
  { id: 'aws-key', label: 'an AWS access key', test: (t) => (t.match(/\bAKIA[0-9A-Z]{16}\b/) || [null])[0] },
  { id: 'private-key', label: 'a private key block', test: (t) => (t.match(/-----BEGIN [A-Z ]*PRIVATE KEY-----/) || [null])[0] },
  {
    id: 'password',
    label: 'a plaintext password',
    test: (t) => (t.match(/\b(password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{4,}/i) || [null])[0],
  },
];

/** Scan user input against the guardrail rules. Pure, offline, sync. */
export function scanPrompt(input: string, level: GuardLevel = 'standard'): GuardVerdict {
  if (level === 'off') return { allowed: true, violations: [], warnings: [] };
  const text = input ?? '';
  const violations: GuardViolation[] = [];
  const warnings: string[] = [];

  for (const rule of HARD_RULES) {
    for (const p of rule.patterns) {
      const m = text.match(p);
      if (m) {
        violations.push({ id: rule.id, category: rule.category, severity: rule.severity, match: m[0].slice(0, 60) });
        break;
      }
    }
  }

  for (const p of PII_RULES) {
    const hit = p.test(text);
    if (hit) {
      // In strict mode secrets are blocking; otherwise they only warn.
      if (level === 'strict') {
        violations.push({ id: 'pii-' + p.id, category: 'Sensitive data', severity: 'high', match: String(hit).slice(0, 40) });
      } else {
        warnings.push(`I spotted ${p.label} in your message — consider masking it before sharing.`);
      }
    }
  }

  return { allowed: violations.length === 0, violations, warnings };
}

/** Friendly, helpful refusal shown in the chat thread. */
export function guardRefusal(verdict: GuardVerdict): string {
  const cats = Array.from(new Set(verdict.violations.map((v) => v.category)));
  return [
    '🛡️ **Request blocked by AI Safety Guardrails**',
    '',
    `Your request matched restricted categories: ${cats.join(', ')}.`,
    'FileMind refuses to help with harmful, unsafe, or unauthorized content.',
    '',
    'I can still help you with safe alternatives — for example:',
    '• Understanding security concepts defensively (how protections work)',
    '• Summarizing or analyzing your vault documents',
    '• Research, writing, coding and everyday questions',
  ].join('\n');
}

/** Mask detected secrets/PII before echoing text anywhere. */
export function maskPII(text: string): string {
  let out = text ?? '';
  for (const p of PII_RULES) {
    const hit = p.test(out);
    if (hit) out = out.split(hit).join('•'.repeat(Math.min(24, String(hit).length)));
  }
  return out;
}

/**
 * Strip injection-style instructions out of retrieved document context
 * so uploaded files cannot hijack the assistant's system prompt.
 */
export function sanitizeContext(text: string): string {
  const lines = (text ?? '').split('\n');
  const kept = lines.filter(
    (l) =>
      !/^\s*(ignore\s+(all|any|the|your|previous|above)?\s*(instructions?|rules?|prompts?)|you\s+are\s+now\s+(dan|jailbroken|evil)|system\s*:\s*override|<\s*system\s*>)/i.test(l)
  );
  return kept.join('\n');
}
