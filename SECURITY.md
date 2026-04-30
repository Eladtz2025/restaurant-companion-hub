# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by email to: **security@restaurant-os.example.com**

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You will receive an acknowledgement within **48 hours** and a detailed response within **7 days**.

## Supported Versions

| Version        | Supported |
| -------------- | --------- |
| Latest `main`  | ✅ Yes    |
| Older branches | ❌ No     |

## Disclosure Timeline

| Day | Action                                        |
| --- | --------------------------------------------- |
| 0   | Report received, acknowledgement sent         |
| 7   | Initial assessment and response               |
| 30  | Fix developed and tested                      |
| 45  | Fix deployed to production                    |
| 60  | Public disclosure (coordinated with reporter) |

We follow responsible disclosure. We will credit researchers who report valid vulnerabilities unless they prefer to remain anonymous.

## Scope

In scope:

- Authentication and authorization bypass
- RLS policy violations (tenant data leakage)
- SQL injection
- XSS in the web interface
- Exposed secrets or credentials

Out of scope:

- Issues in third-party services (Supabase, Vercel, Inngest)
- Rate limiting on public endpoints
- Theoretical vulnerabilities without proof of concept
