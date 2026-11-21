# Inline SFC

This example puts a Vue single-file component directly in `main`. It is useful
for small generated views or integrations where creating a separate `.vue`
file would add unnecessary project setup.

The inline source contains `<script setup>` and a template, so it is compiled
by Vite in development and by the production build just like a file-based
SFC.

## Run and render

```sh
npx vueforge serve --dev

curl -X POST http://127.0.0.1:9901/render \
  -H 'Content-Type: application/json' \
  -d '{"props":{"name":"Ada"}}'
```

The rendered content is `<h1>Hello Ada</h1>`. The body remains the complete
application context and `props` is passed to the inline component.
