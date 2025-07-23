FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HOME="/app"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS prod-deps
COPY ./package.json ./pnpm-lock.yaml .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
EXPOSE 3000
CMD [ "pnpm", "start" ]