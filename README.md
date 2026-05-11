# prompt-injection-lab
Educational prompt injection lab. A realistic-looking internal AI coding assistant, deliberately vulnerable, used to try how LLM applications get attacked.

## ⚠️ Security notice

This is **deliberately vulnerable software** built for education. Don't deploy it as a real coding assistant. The "secrets" in the system prompt are decoys, but the patterns this app demonstrates (storing credentials in prompts, trusting LLM output, executing tool calls based on user input) are real attack surfaces.

If you fork this for your own workshop:
- Don't add real credentials, even temporarily
- Don't expose it to the open internet without rate limiting
- Run it behind something like Tailscale Funnel rather than public IP
- Destroy the deployment after your workshop
