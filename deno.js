// deno.json - Configuration file for the Deno project
{
  "tasks": {
    "start": "deno run --allow-net --allow-env server.ts"
  },
  "imports": {
    "oak": "https://deno.land/x/oak@v12.6.1/mod.ts",
    "cors": "https://deno.land/x/cors@v1.2.2/mod.ts"
  }
}
