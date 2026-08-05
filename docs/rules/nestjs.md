# NestJS rules

Read this when working on a NestJS app. [backend.md](backend.md) still applies —
everything here is the NestJS way of following it, not a replacement.

No app uses NestJS yet. This document exists so the choice is already made when
one does.

## 1. When to pick NestJS over Express

Both are allowed. The choice is made per app, once, and written into that app's
document.

| Pick NestJS when                                 | Pick Express when                                    |
| ------------------------------------------------ | ---------------------------------------------------- |
| The app has many endpoints and will keep growing | The app is small, or is a worker with a health check |
| You want structure enforced rather than agreed   | You want to see every moving part                    |
| You need DI, guards, interceptors, or WebSockets | Adding a framework would be most of the code         |
| TypeScript everywhere, decorators are welcome    | Plain JavaScript is fine                             |

NestJS costs a build step, a decorator-heavy style, and more to learn. It pays
that back when an app is big enough that the structure would otherwise be
invented by hand, badly.

Do not mix: one app, one framework.

## 2. Modules are features, not layers

One module per feature, holding everything that feature needs:

```
src/
├── matches/
│   ├── matches.module.ts
│   ├── matches.controller.ts
│   ├── matches.service.ts
│   ├── dto/
│   │   ├── create-match.dto.ts
│   │   └── query-matches.dto.ts
│   └── entities/
│       └── match.entity.ts
├── common/          # guards, filters, interceptors, pipes used by many features
├── config/          # configuration and its validation
└── main.ts
```

- **Never make a `controllers/` or `services/` folder at the top.** Grouping by
  layer means every change to one feature touches four distant folders.
- A module exports only what other modules genuinely need. Everything else stays
  private to it.
- `AppModule` wires modules together and holds nothing of its own.
- If two modules import each other, the shared part belongs in a third module.
  `forwardRef` hides the problem instead of fixing it.

## 3. Controllers stay thin

A controller maps HTTP to a service call. That is all it does.

```ts
@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.matches.findOne(id);
  }
}
```

- No business rules, no database access, no `try/catch` around the service call.
- Return the value. Nest serialises it and sets the status code. Do not reach for
  `@Res()` — it opts you out of that, and out of interceptors.
- The service never receives `req` or `res`. It takes plain arguments, so a cron
  job can call the same method.

## 4. Injection

- **Constructor injection with `private readonly`.** Not property injection, and
  never `new SomeService()` inside another service — that skips the container
  and makes the class untestable.
- Depend on the class, not on a string token, unless you genuinely need several
  implementations.
- A provider that talks to something outside the app (an HTTP API, a queue) is
  its own class, so a test can replace it.

## 5. Validation

Every request body, query and param is validated before it reaches a service.

Turn it on globally in `main.ts`:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // strip properties with no decorator
    forbidNonWhitelisted: true, // and reject the request if any were sent
    transform: true, // turn the plain object into the DTO class
  }),
);
```

- **A DTO class per input**, with `class-validator` decorators. Not an interface
  — interfaces disappear at runtime and cannot validate anything.
- `whitelist` matters: without it, extra fields travel into your service and,
  eventually, into the database.
- Use a separate DTO for the response when the entity holds anything the caller
  must not see. `@Exclude()` on the entity plus `ClassSerializerInterceptor`
  works too — pick one and use it everywhere.

## 6. Configuration

- `@nestjs/config` with `isGlobal: true`, loaded once in `AppModule`.
- **Validate the schema at startup** so a missing variable stops the app instead
  of surfacing on the first request.
- Read values through `ConfigService`. `process.env` appears nowhere else in the
  app.

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validate: (env) => configSchema.parse(env), // throws on a missing variable
});
```

Values still come from Infisical at run time — see the secrets section of
[backend.md](backend.md#2-configuration-and-secrets).

## 7. Errors

- Throw Nest's built-in exceptions for expected failures: `NotFoundException`,
  `BadRequestException`, `ConflictException`. They carry the right status code.
- Throw them **from the service**, not the controller. The service knows that the
  match does not exist; the controller only knows it got a request.
- One global exception filter turns anything unexpected into a 500 and logs it.
  It is the only place that decides what an unhandled error looks like.
- Never return `null` to mean "not found" and let the controller guess.

## 8. Database

Follow [backend.md](backend.md#6-databases). In NestJS terms:

- The database module is imported with `forRootAsync` so it can read config
  through `ConfigService` instead of `process.env`.
- Repositories are injected into services. A controller never sees one.
- Entities and migrations live with the feature they belong to.
- Close the connection on shutdown — enable `app.enableShutdownHooks()` and let
  the module's own lifecycle handle it.

## 9. Cross-cutting work has a place already

Do not solve these inside a controller:

| Need                               | Use              |
| ---------------------------------- | ---------------- |
| Is this caller allowed?            | Guard            |
| Change the request or the response | Interceptor      |
| Transform or validate one value    | Pipe             |
| Turn an error into a response      | Exception filter |
| Run before the route is matched    | Middleware       |

Register them globally when they apply everywhere, on the controller when they
apply to one feature.

## 10. Logging and health

- Logs go to Axiom, following [backend.md](backend.md#4-logging). Use
  `nestjs-pino` so the framework's own logger and yours end up in the same
  stream, with the request id attached.
- Do not use the default `Logger` for anything a person needs to search later —
  it writes text, not structured events.
- `@nestjs/terminus` for `/health`.

## 11. Testing

- Unit tests build the service with `Test.createTestingModule` and replace its
  providers. No database.
- End-to-end tests boot the real app and hit routes through `supertest`.
- If a class is hard to test, it usually depends on something it should have been
  given. That is a design signal, not a testing problem.
