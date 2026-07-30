# Entity-Relationship Diagram

Database: **PostgreSQL 15** · ORM: **Prisma**

This diagram covers the core competition domain entities. See `database/prisma/schema.prisma` for the full schema including sponsors, weather, notifications, and offline sync.

```mermaid
erDiagram
    User ||--o{ Score : "enters"
    User ||--o{ ScoreApproval : "approves"
    User ||--o{ PrintHistory : "prints"
    User ||--o{ AuditLog : "performs"
    User ||--o{ CompetitionUser : "assigned to"

    Competition ||--o{ Pilot : "registers"
    Competition ||--o{ Team : "has"
    Competition ||--o{ Round : "schedules"
    Competition ||--o{ IndividualRanking : "ranks"
    Competition ||--o{ TeamRanking : "ranks teams"
    Competition ||--o{ PrintHistory : "generates"
    Competition ||--o{ AuditLog : "logged in"
    Competition ||--|| CompetitionSettings : "configured by"
    Competition ||--o{ CompetitionUser : "staff"

    Country ||--o{ Pilot : "nationality"
    Country ||--o{ Team : "represents"

    Pilot ||--o{ Flight : "flies"
    Pilot ||--o{ Score : "receives"
    Pilot ||--o{ IndividualRanking : "ranked as"
    Pilot ||--o{ TeamMember : "member of"

    Team ||--o{ TeamMember : "contains"
    Team ||--o{ TeamScore : "scored in"
    Team ||--o{ TeamRanking : "ranked as"

    Round ||--o{ Flight : "contains"
    Round ||--o{ Score : "aggregates"
    Round ||--o{ TeamScore : "team round total"
    Round ||--o{ ScoreApproval : "requires"
    Round ||--o{ PrintHistory : "printed for"
    Round ||--o| Round : "reflight of"

    Flight ||--|| Score : "has one"
    Score ||--o{ Penalty : "may have"

    User {
        string id PK
        string email UK
        string passwordHash
        string firstName
        string lastName
        enum role
        enum status
        datetime createdAt
    }

    Competition {
        string id PK
        string name
        string code UK
        string publicSlug UK
        enum status
        enum ruleSet
        datetime startDate
        datetime endDate
        boolean isPublished
    }

    Pilot {
        string id PK
        string competitionId FK
        int pilotNumber
        string firstName
        string lastName
        enum gender
        enum status
        boolean isWomen
        boolean isJunior
    }

    Team {
        string id PK
        string competitionId FK
        string name
        enum type
        string countryId FK
        boolean isValid
    }

    Round {
        string id PK
        string competitionId FK
        int number
        enum type
        enum status
        datetime scheduledAt
        datetime approvedAt
    }

    Flight {
        string id PK
        string roundId FK
        string pilotId FK
        int flightOrder
        enum status
        boolean isReflight
    }

    Score {
        string id PK
        string flightId FK UK
        string roundId FK
        string pilotId FK
        float distanceCm
        float finalScoreCm
        enum resultType
        enum status
        boolean isBullseye
        boolean isDiscarded
    }

    TeamScore {
        string id PK
        string teamId FK
        string roundId FK
        float totalScoreCm
        json countedPilots
        json auditJson
    }

    IndividualRanking {
        string id PK
        string competitionId FK
        string pilotId FK
        string category
        int rank
        float totalScoreCm
        int bullseyes
        float discardedScoreCm
    }

    PrintHistory {
        string id PK
        string competitionId FK
        string roundId FK
        string reportType
        enum status
        string fileUrl
        datetime printedAt
    }

    AuditLog {
        string id PK
        string competitionId FK
        string userId FK
        string action
        string entityType
        string entityId
        json beforeJson
        json afterJson
        datetime createdAt
    }
```

---

## Key relationships

| Relationship | Cardinality | Notes |
|--------------|-------------|-------|
| Competition → Pilot | 1:N | Unique `(competitionId, pilotNumber)` |
| Competition → Round | 1:N | Unique `(competitionId, number, type)` |
| Round → Flight | 1:N | Unique `(roundId, pilotId)` and `(roundId, flightOrder)` |
| Flight → Score | 1:1 | One score per flight |
| Team → TeamMember → Pilot | M:N via junction | Reserve vs scoring role |
| Team + Round → TeamScore | 1:1 per pair | Best-3 team calculation stored as JSON audit |
| Competition + Pilot + Category → IndividualRanking | 1:1 | Unique triple |

---

## Indexes

Performance-critical indexes:

- `Score.finalScoreCm`, `Score.status` — ranking queries
- `IndividualRanking(competitionId, category, rank)` — leaderboard
- `AuditLog(createdAt)` — audit export
- `Pilot(competitionId, status)` — active pilot lists

---

## Related

- [Architecture Overview](OVERVIEW.md)
- [Prisma schema](../../database/prisma/schema.prisma)
