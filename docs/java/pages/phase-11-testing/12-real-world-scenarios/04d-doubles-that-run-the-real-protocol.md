---
title: "The best doubles are not mock servers with hardcoded fixtures but real implementations of the protocol — LocalStack, GreenMail, an embedded broker — and the single property that decides how much a test against one is worth is whether the double keeps state"
sidebar_label: "04d · Doubles that run the protocol"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5** LocalStack module page
> ([java.testcontainers.org](https://java.testcontainers.org/modules/localstack/)) and
> **GreenMail**'s `GreenMailExtension` source and javadoc
> ([github.com/greenmail-mail-test/greenmail](https://github.com/greenmail-mail-test/greenmail/blob/master/greenmail-junit5/src/main/java/com/icegreen/greenmail/junit5/GreenMailExtension.java))
> — package `com.icegreen.greenmail.junit5`, artifact `com.icegreen:greenmail-junit5`,
> 2.1.3, which is ⚠️ **not** managed by the Spring Boot BOM and must be pinned by you.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No sandbox and no Docker on this machine** — this page carries Java source and
> documented behaviour, never container logs, timings or test output.

**[04c](04c-the-sdks-own-test-double.md) ended on the limitation that decides everything:
stripe-mock is stateless, so a create-then-fetch test against it proves nothing. This page
is about the doubles on the other side of that line — the ones that implement the protocol
rather than serving a fixture catalogue. They cost more to start and they are worth
disproportionately more, because with them a round-trip assertion is a real assertion.**

## Stateful or not is the question to ask first

Before writing a line against any double, establish one thing: **if I write, can I read it
back?**

| Double | Stateful | So a round-trip test is |
|---|---|---|
| A mock of the SDK client | no | meaningless |
| stripe-mock | no — *"completely ignored beyond that"* | meaningless |
| A hand-written WireMock stub | only as far as you programmed it | as good as your stubbing |
| **LocalStack (S3, SQS, DynamoDB)** | yes | real |
| **GreenMail** | yes — messages accumulate in mailboxes | real |
| **An embedded broker** (Kafka, ActiveMQ) | yes | real |
| **Testcontainers PostgreSQL** | yes | real (**topic 07** owns this) |

The consequence is blunt. Against a stateless double you may only assert on *the request
you sent*. Against a stateful one you may also assert on *the state you left behind*, which
is usually the thing the feature is actually about.

## LocalStack, and the AWS case

For AWS the vendor double is a third party that has become the de facto standard, and
Testcontainers ships a module for it. The Testcontainers documentation describes LocalStack
as:

> *"a fully functional local AWS cloud stack, to develop and test your cloud and serverless
> apps without actually using the cloud."*

```java
@Testcontainers
class DocumentStoreTest {

    @Container
    static LocalStackContainer localstack =
            new LocalStackContainer(LocalstackTestImages.LOCALSTACK_IMAGE)
                    .withServices("s3");

    private S3DocumentStore store;

    @BeforeEach
    void setUp() {
        S3Client s3 = S3Client.builder()
                .endpointOverride(localstack.getEndpoint())
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(
                                localstack.getAccessKey(), localstack.getSecretKey())))
                .region(Region.of(localstack.getRegion()))
                .build();
        s3.createBucket(b -> b.bucket("documents"));
        store = new S3DocumentStore(s3, "documents");
    }
}
```

LocalStack sits higher on the fidelity ladder than stripe-mock because it *is* stateful —
a `putObject` followed by a `getObject` returns your bytes, so round-trip tests are real
tests. That makes it genuinely useful for the storage adapter. What it does not faithfully
reproduce is IAM: permissions that LocalStack waves through will be denied in production,
so "the test passed" says nothing about whether the deployed role can write to the bucket.

Container lifecycle, the singleton pattern, reuse and the cost of all this belongs to
**topic 07 · Testcontainers**, which owns it. The only thing worth adding here is that an
adapter test is the *best* possible candidate for a shared singleton container, because
there are six of them and they all want the same thing.

## GreenMail: the in-process case, and why it is the nicest of the lot

Mail is the happy exception — the double is a Java library that runs in your JVM, so there
is no container, no Docker and no port negotiation with a daemon.

```java
class ReceiptMailerTest {

    @RegisterExtension
    static GreenMailExtension greenMail =
            new GreenMailExtension(ServerSetupTest.SMTP)
                    .withPerMethodLifecycle(false);

    @Test
    void aReceiptIsAddressedToTheCustomerAndCarriesTheOrderNumber() throws Exception {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost("localhost");
        sender.setPort(greenMail.getSmtp().getPort());

        new ReceiptMailer(sender, templates).send(anOrder().withNumber("10042").build());

        MimeMessage[] received = greenMail.getReceivedMessages();
        assertThat(received).hasSize(1);
        assertThat(received[0].getAllRecipients()[0]).hasToString("buyer@example.com");
        assertThat(received[0].getSubject()).contains("10042");
    }
}
```

⚠️ `GreenMailExtension` is a JUnit 5 extension registered with `@RegisterExtension`, and its
own javadoc states that *"By default, you get a new GreenMail instance per method"* — which
is what you want for isolation, and what makes `withPerMethodLifecycle(false)` a deliberate
speed-for-isolation trade rather than a default. GreenMail is **not** in the Spring Boot
BOM, so you pick and pin the version yourself (`com.icegreen:greenmail-junit5`, 2.1.3 at
the time of writing).

## The catalogue, by protocol

The question "is there a double that runs the real protocol?" has an answer per protocol,
not per vendor, and the answer is much more often yes than teams assume.

- **SMTP / IMAP / POP3** — GreenMail, in-process. The best case on this page.
- **AWS S3 / SQS / SNS / DynamoDB / Lambda** — LocalStack, a container, stateful, official
  Testcontainers module.
- **Azure Blob Storage** — Azurite, Microsoft's own emulator, a container.
- **Google Cloud Storage / Pub/Sub / Firestore** — the vendor's own emulators, containers,
  stateful, and unusually faithful because Google runs them itself.
- **Kafka** — either `EmbeddedKafkaKraftBroker` in-process (spring-kafka 4.1.0) or a
  Testcontainers Kafka container; see [08](08-a-message-consumer.md).
- **RabbitMQ** — a container, or Spring AMQP's `TestRabbitTemplate` which bypasses the
  broker entirely; see [08b](08b-the-container-poison-messages-and-redelivery.md).
- **LDAP** — an embedded directory server, in-process.
- **Anything HTTP with no double at all** — WireMock or `MockWebServer`, which is **fork
  C's 03b**, and is where you end up for the long tail of vendors.

Two protocols where the honest answer is *no useful double exists*: card payment
authorisation (nobody emulates an acquirer's decision logic) and third-party OAuth
providers' consent screens. For those, the double covers request shape only and the real
behaviour is verified in staging.

## Where this connects

- The ranking of double options and the stripe-mock limitations that motivate this page are
  in [04c · The SDK's own test double](04c-the-sdks-own-test-double.md).
- **Topic 07 · Testcontainers** owns container lifecycle, `@ServiceConnection`, the
  singleton pattern, reuse and the runtime cost. Every container on this page is subject to
  that topic's rules and this page does not repeat them.
- **Topic 01 · JUnit 5** owns `@RegisterExtension`, extension lifecycle and
  `@TestInstance(PER_CLASS)`, all of which GreenMail's javadoc leans on.
- Message brokers as doubles, and the difference between testing the handler and testing
  the container, are [08 · A message consumer](08-a-message-consumer.md) and
  [08b](08b-the-container-poison-messages-and-redelivery.md).

## Gotchas

**★ LocalStack's permissiveness about IAM is the specific thing it does not reproduce.**
Storage adapter tests against LocalStack pass with credentials that have effectively no
policy attached. Production runs under a role with a scoped policy, and the first
`AccessDenied` arrives after deploy. LocalStack is a good test of *your code's* correctness
against S3's API and a bad test of *your deployment's* permissions; only an actual
deployment tests the latter.

**★ Every container in an adapter test is a container the whole suite pays for unless it is
shared.**
Six adapter test classes each with their own `@Container` is six container starts. This is
exactly the case **topic 07 · Testcontainers** solves with a static singleton, and adapter
tests are the easiest place to apply it because they all want the same image with the same
configuration. Getting this wrong is how a suite that ran in 40 seconds becomes one that
runs in eight minutes without anybody noticing the day it happened.

**★ GreenMail's default per-method lifecycle is the isolation you want, and turning it off
is how one test starts seeing another test's mail.**
`withPerMethodLifecycle(false)` is the documented speed option, but the received-message
buffer is then shared: `getReceivedMessages()` in the second test returns the first test's
message too, and `hasSize(1)` fails in a way that looks like your code sent two emails.
Either keep the per-method default or call `greenMail.purgeEmailFromAllMailboxes()` in a
`@BeforeEach` — do not do neither.

**★ A stateful double shared across a suite carries state across tests, and that is the
price of sharing it.**
The property that makes LocalStack worth using — a `putObject` is really there afterwards —
is the same property that makes the second test see the first test's object. A bucket
created in one class exists for every later class in the same JVM. Either create a
uniquely-named bucket or prefix per test class, or delete what you created in an
`@AfterEach`. **Topic 07 · Testcontainers** owns the general cleanup argument; the specific
trap for object storage is that listing a prefix returns other tests' keys and your
`hasSize(1)` becomes `hasSize(4)` only when the suite runs in a particular order.

**★ An in-process double still binds a port, and a hardcoded port is a suite that cannot
run twice at once.**
GreenMail's `ServerSetupTest` constants use fixed offsets so two JVMs on the same machine
collide, and so does a developer running the suite while the application runs locally. Use
`greenMail.getSmtp().getPort()` rather than a literal, and treat any literal port number in
a test as a defect waiting for parallel execution. **Topic 01 · JUnit 5**'s
*ports, network and the database* chunk owns the general form.

**★ An emulator's error responses are its own inventions, not the vendor's.**
LocalStack returning `NoSuchKey` matches S3; LocalStack's message when you exceed a quota
does not, because it has no quotas. So an adapter test that asserts on the *text* or the
*specific error code* of a failure from an emulator is asserting on the emulator. Assert on
the exception type your adapter produced and on the branch it took, not on the vendor
string that got it there.

**★ A container-based double couples your test suite to a Docker daemon, and that is a
policy decision, not a technical detail.**
Some organisations' CI runners have no daemon; some developer laptops run a runtime that
Testcontainers must be told about. Before you make LocalStack load-bearing for the storage
adapter, check that everyone who runs the suite can start a container, and if they cannot,
tag those tests so a `mvn test` without Docker still passes with a clear "skipped" rather
than an unexplained error. **Topic 07 · Testcontainers** owns the alternative-runtime
detail.

## Interview questions

**★ Why is GreenMail a better shape of double than most, and what does that tell you about
choosing doubles generally?**
Because it runs in the same JVM: no Docker daemon, no port allocation from an external
process, no image pull in CI, and the test can inspect the delivered `MimeMessage` as a
Java object rather than parsing a transcript. That combination — in-process, real protocol
implementation, direct access to the received artefact — is the ideal, and it is available
whenever the protocol is simple enough to implement in a library (SMTP, FTP, an embedded
database, an embedded message broker). The generalisation is: prefer an in-process
implementation of the *protocol* over a container running the *product*, and prefer either
over a mock of the client, but only where such an implementation genuinely exists. Nobody
is going to write an in-process Stripe.

**★ What is the first question you ask about a test double you have not used before?**
Whether it keeps state. Everything else follows from that answer. A stateless double
restricts you to asserting on the request you sent, and any round-trip test written against
it passes for a reason unrelated to your code — the fixture was going to come back
regardless. A stateful double lets you assert on the effect, which is what the feature is
about, and simultaneously creates a cleanup obligation you did not have before. Teams get
burned in both directions: writing round-trip assertions against a stateless double, and
sharing a stateful double across a suite without cleaning up.

**★ LocalStack passes, production returns `AccessDenied`. Whose fault is the test?**
Nobody's — it is a correct test of the wrong thing, and the useful response is to be
precise about what each layer covers. The LocalStack test covers your adapter's use of the
S3 API: bucket, key, content type, the exception you throw when the object is missing. It
cannot cover the deployed role's policy, because the emulator has no meaningful IAM. That
gap is closed by infrastructure verification — a policy test in your IaC tooling, or a
startup health check that does a real `headBucket` against the real bucket with the real
role and fails the deployment loudly. Trying to close it with a better emulator is chasing
fidelity you will never reach.

**★ Your team wants to replace the Testcontainers PostgreSQL in the repository tests with
an in-memory database because "it is the same idea as GreenMail". Are they right?**
No, and the distinction is exactly the one this page is built on. GreenMail implements SMTP
— the actual protocol, faithfully, because SMTP is small and fully specified. An in-memory
SQL database implements *a* SQL dialect, not PostgreSQL's, and the divergences are in
precisely the places you care about: types, isolation, locking, the planner and the error
codes. The test for whether an in-process double is legitimate is whether it implements the
same protocol or merely a similar one. **Topic 07 · Testcontainers** makes that case at
length for databases specifically; the short version is that "passed on H2" is not evidence.

{/* FOOTER */}
