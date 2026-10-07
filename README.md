# 💊 SmartMed Cycle

A patient-facing medicine companion, ported from a PartyRock prototype to a real
deployable AWS application: **Lambda (streaming) + Function URLs + Bedrock
(Claude Haiku 4.5) + S3 static hosting + GitHub Actions CI/CD**.

> ⚠️ SmartMed Cycle is a preparation tool only. It is not a substitute for
> pharmacist or prescriber advice.

## Features

| Section | What it does |
|---|---|
| 🔎 Understand My Medicine | Snap or type a label → get a plain-language Medicine Card |
| 🛡️ Check My Precautions | Enter other medicines & allergies → get discussion points for your pharmacist |
| 💬 Ask About My Medicines | Chat with SmartMed Help — supports Quiz Mode & Pharmacist Summary |
| ♻️ Return Unused Medicines | Prepare a return plan with links to the official myMediSAFE directory |

## Architecture

```
Browser (S3 static site)
   │  fetch() streaming POST
   ▼
Lambda Function URL (RESPONSE_STREAM)
   │  Lambda Web Adapter (/opt/bootstrap)
   ▼
Flask app.py  →  bedrock.invoke_model_with_response_stream()
   │
   ▼
Amazon Bedrock — global.anthropic.claude-haiku-4-5-20251001-v1:0
```

Five independent streaming Lambdas, one per AI widget:

| Lambda | Purpose |
|---|---|
| `extract_from_photo` | Pulls label fields out of an uploaded photo |
| `medicine_card` | Builds the plain-language Medicine Card |
| `my_medicine_summary` | Builds the Section 2 precautions summary |
| `my_return_plan` | Builds the medicine return/disposal plan |
| `smartmed_help` | Chat assistant (Quiz Mode + Pharmacist Summary) |

## Repository layout

```
backend/
  extract_from_photo/   app.py, run.sh, requirements.txt
  medicine_card/
  my_medicine_summary/
  my_return_plan/
  smartmed_help/
frontend/
  index.html            all 20 widgets, same order as the PartyRock app
  app.js                streaming fetch, markdown renderer, file upload
  styles.css
infra/
  template.yaml          AWS SAM template
.github/workflows/
  deploy.yml             CI/CD: build → deploy → inject URLs → sync to S3
```

## ⚠️ Known deviation from the PartyRock app: web search

The PartyRock widgets had **"Web search: enabled"**, which let the model pull
live citations (DailyMed, MedlinePlus, drug interaction checkers, real
facility listings for myMediSAFE, etc.) at generation time.

Plain `bedrock.invoke_model_with_response_stream` (the raw Anthropic Messages
API, as this build uses per the spec) has **no built-in web browsing** — that
requires either Bedrock Agents with an action group, or a separate search API
(e.g. Tavily, Bing, SerpAPI) wired in as a tool-use step before the final
generation call. This build does **not** include that, so:

- Prompts are written so the model only cites a source if it is confident the
  title/URL are real from training knowledge, and omits the sources section
  otherwise, rather than inventing URLs.
- `my_return_plan` does **not** fabricate specific facility names/addresses.
  Instead it always surfaces the official myMediSAFE links and constructs
  Google Maps search links from the patient's typed location — the same
  fallback behaviour the original prompt specified for unverifiable facilities.

If you want real-time web search and live facility lookup, the natural next
step is adding a Bedrock Agent (or a search-API tool-use loop) in front of
`medicine_card`, `my_medicine_summary`, and `my_return_plan`. Happy to build
that as a follow-up if you want it.

## Pre-deployment checklist

1. **Enable Bedrock model access** in the AWS Console → Bedrock → Model access,
   in **ap-southeast-1**, for:
   - `global.anthropic.claude-haiku-4-5-20251001-v1:0` (Claude Haiku 4.5 — global
     cross-region inference profile)
   
   First-time accounts must submit a use-case access request form before the
   model becomes invokable.

2. **Create an S3 bucket for SAM deploy artifacts** (separate from the
   frontend hosting bucket, which the template creates for you):
   ```powershell
   aws s3 mb s3://<your-sam-deploy-bucket> --region ap-southeast-1
   ```

3. **Add GitHub repository secrets** (Settings → Secrets and variables → Actions):
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `SAM_DEPLOY_BUCKET` — the bucket name from step 2

   Use an IAM user/role scoped to CloudFormation, Lambda, IAM role creation,
   S3, and Bedrock — not root credentials.

4. **Push to `main`** (or run the workflow manually via Actions →
   "Deploy SmartMed Cycle" → Run workflow). The pipeline will:
   - `sam build` + `sam deploy` the stack `smartmed-cycle`
   - Read the 5 Function URLs + bucket name from CloudFormation outputs
   - `sed` them into `frontend/app.js` in place of the `__URL_...__` placeholders
   - `aws s3 sync frontend/ s3://<bucket> --cache-control no-cache`

5. **Open the site** — the workflow prints the `WebsiteUrl` output at the end,
   or fetch it any time with:
   ```powershell
   aws cloudformation describe-stacks --stack-name smartmed-cycle `
     --query "Stacks[0].Outputs[?OutputKey=='WebsiteUrl'].OutputValue" --output text
   ```

## Local testing (optional)

Each Lambda is a plain Flask app, so you can run and curl it directly:

```powershell
cd backend/medicine_card
pip install -r requirements.txt
python app.py
```

```powershell
curl.exe -X POST http://localhost:8080/ -H "Content-Type: application/json" `
  -d '{\"preferred_language\":\"English\",\"medicine_details\":\"Metformin 500mg twice daily\"}'
```

Note: local runs need valid AWS credentials in the environment with Bedrock
access (`aws configure` or exported `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`),
since the Flask app calls Bedrock directly — there is no local mock.

## Notes on IAM / region

The cross-region `global.` inference profile for Claude Haiku 4.5 may route
requests to other regions (e.g. us-east-2, us-west-2) under the hood. That's
why `AppBedrockRole`'s Bedrock permissions use `*` for the region segment of
the resource ARNs instead of hard-coding `ap-southeast-1`.
