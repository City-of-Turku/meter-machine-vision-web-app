# Machine Vision & Meter Reader Web App

This application serves as a testing platform for machine vision, meter reading, and similar use cases.
It includes both a traditional OCR reader and an AI-based image reader.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Create .env.local file and add following envs:

- `AZURE_ENDPOINT` e.g. "https://your-endpoint.cognitiveservices.azure.com/"
- `AZURE_KEY`
- `AZURE_OPENAI_ENDPOINT` e.g. "https://your-endpoint.openai.azure.com/"
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT_NAME`
- `AZURE_OPENAI_API_VERSION`

To enable the mock switch for debugging purposes, set a truthy value for the following environment variable:

- `NEXT_PUBLIC_MOCK_SWITCH`

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Docker Deployment

To run this app with Docker or another container environment, ensure that Docker is correctly installed.
Next, make sure you have created and populated the required .env files.
Then, create a `Caddyfile` based on the provided `Caddyfile.example`.

To build the Docker images, run:

```
docker compose build
```

After building the images, start the app with:

```
docker compose up
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
