import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DOMAINS = [
  { name: 'Workout', color: '#f97316', icon: 'dumbbell', weight: 1.0 },
  { name: 'Study', color: '#3b82f6', icon: 'book-open', weight: 1.0 },
  { name: 'Coding', color: '#22c55e', icon: 'code-2', weight: 1.0 },
  { name: 'Reading', color: '#a855f7', icon: 'library', weight: 1.0 },
  { name: 'Business', color: '#eab308', icon: 'trending-up', weight: 1.0 },
  { name: 'Faith', color: '#e2e8f0', icon: 'heart', weight: 1.0 },
]

const BOOKS = [
  { title: 'Atomic Habits', author: 'James Clear', order: 1 },
  { title: 'The Confidence Gap', author: 'Russ Harris', order: 2 },
  { title: 'How to Win Friends and Influence People', author: 'Dale Carnegie', order: 3 },
  { title: 'The Psychology of Money', author: 'Morgan Housel', order: 4 },
  { title: 'Rich Dad Poor Dad', author: 'Robert Kiyosaki', order: 5 },
  { title: 'Never Split the Difference', author: 'Chris Voss', order: 6 },
  { title: 'Think and Grow Rich', author: 'Napoleon Hill', order: 7 },
  { title: 'The Lean Startup', author: 'Eric Ries', order: 8 },
]

// New Testament chapter-by-chapter reading plan
const NT_PLAN = [
  // Matthew (28 chapters)
  ...Array.from({ length: 28 }, (_, i) => `Matthew ${i + 1}`),
  // Mark (16 chapters)
  ...Array.from({ length: 16 }, (_, i) => `Mark ${i + 1}`),
  // Luke (24 chapters)
  ...Array.from({ length: 24 }, (_, i) => `Luke ${i + 1}`),
  // John (21 chapters)
  ...Array.from({ length: 21 }, (_, i) => `John ${i + 1}`),
  // Acts (28 chapters)
  ...Array.from({ length: 28 }, (_, i) => `Acts ${i + 1}`),
  // Romans (16 chapters)
  ...Array.from({ length: 16 }, (_, i) => `Romans ${i + 1}`),
  // 1 Corinthians (16 chapters)
  ...Array.from({ length: 16 }, (_, i) => `1 Corinthians ${i + 1}`),
  // 2 Corinthians (13 chapters)
  ...Array.from({ length: 13 }, (_, i) => `2 Corinthians ${i + 1}`),
  // Galatians (6 chapters)
  ...Array.from({ length: 6 }, (_, i) => `Galatians ${i + 1}`),
  // Ephesians (6 chapters)
  ...Array.from({ length: 6 }, (_, i) => `Ephesians ${i + 1}`),
  // Philippians (4 chapters)
  ...Array.from({ length: 4 }, (_, i) => `Philippians ${i + 1}`),
  // Colossians (4 chapters)
  ...Array.from({ length: 4 }, (_, i) => `Colossians ${i + 1}`),
  // 1 Thessalonians (5 chapters)
  ...Array.from({ length: 5 }, (_, i) => `1 Thessalonians ${i + 1}`),
  // 2 Thessalonians (3 chapters)
  ...Array.from({ length: 3 }, (_, i) => `2 Thessalonians ${i + 1}`),
  // 1 Timothy (6 chapters)
  ...Array.from({ length: 6 }, (_, i) => `1 Timothy ${i + 1}`),
  // 2 Timothy (4 chapters)
  ...Array.from({ length: 4 }, (_, i) => `2 Timothy ${i + 1}`),
  // Titus (3), Philemon (1)
  'Titus 1', 'Titus 2', 'Titus 3', 'Philemon 1',
  // Hebrews (13 chapters)
  ...Array.from({ length: 13 }, (_, i) => `Hebrews ${i + 1}`),
  // James (5 chapters)
  ...Array.from({ length: 5 }, (_, i) => `James ${i + 1}`),
  // 1 Peter (5), 2 Peter (3)
  ...Array.from({ length: 5 }, (_, i) => `1 Peter ${i + 1}`),
  ...Array.from({ length: 3 }, (_, i) => `2 Peter ${i + 1}`),
  // 1 John (5), 2 John (1), 3 John (1)
  ...Array.from({ length: 5 }, (_, i) => `1 John ${i + 1}`),
  '2 John 1', '3 John 1',
  // Jude (1)
  'Jude 1',
  // Revelation (22 chapters)
  ...Array.from({ length: 22 }, (_, i) => `Revelation ${i + 1}`),
]

async function seedLessons(domainMap: Record<string, string>) {
  const lessons = [
    // ── BUSINESS BASICS ───────────────────────────────────────────────────────
    {
      domainId: domainMap['Business'],
      track: 'Business Basics',
      title: 'How Businesses Actually Make Money',
      order: 1,
      content: `## How Businesses Make Money

A business survives on one equation: **Revenue − Costs = Profit**.

### Revenue Streams
Every business earns money through one or more of these:
- **Product sales** — selling physical or digital goods (one-time)
- **Service fees** — charging for time or expertise
- **Subscriptions** — recurring monthly/annual payments (highest lifetime value)
- **Commissions/referrals** — earning a % of someone else's sale
- **Licensing** — letting others use your IP for a fee

### The Margin Mindset
Revenue alone is vanity. Profit margin is what matters.

| Business Type | Typical Margin |
|---|---|
| Physical products | 20–50% |
| Software (SaaS) | 70–90% |
| Services (freelance) | 60–80% |
| Retail | 5–20% |

### Your Template Business
You're selling digital templates. Your costs are near-zero after creation. That means 70–90%+ margins — exactly like software. Every hour spent making a better template is leverage; every sale after the first is almost pure profit.

### Key Insight
Don't think "how do I make money?" — think "what problem am I solving, and who pays to solve it?" The money follows the answer to that question.`,
      quiz: {
        questions: [
          {
            prompt: 'Which revenue model has the highest customer lifetime value?',
            options: JSON.stringify(['One-time product sales', 'Subscriptions', 'Commissions', 'Donations']),
            correctIndex: 1,
          },
          {
            prompt: 'If you sell a template for $30 and your cost is $2 (platform fees), what is your profit margin?',
            options: JSON.stringify(['28%', '6.7%', '93.3%', '50%']),
            correctIndex: 2,
          },
          {
            prompt: 'What is the core equation every business lives or dies by?',
            options: JSON.stringify(['Revenue × Growth Rate', 'Revenue − Costs = Profit', 'Customers × Price', 'Traffic × Conversion Rate']),
            correctIndex: 1,
          },
        ],
      },
    },
    {
      domainId: domainMap['Business'],
      track: 'Saving & Earning',
      title: 'The Pay-Yourself-First Rule',
      order: 1,
      content: `## The Pay-Yourself-First Rule

Most people save whatever's left after spending. That's why most people have nothing saved.

### The Rule
Every time money comes in, **move a fixed percentage to savings immediately** — before you spend anything. Automate it so it's never optional.

### The 50/30/20 Framework (Starting Point)
- **50%** — Needs (food, transport, essential bills)
- **30%** — Wants (entertainment, eating out, new stuff)
- **20%** — Save/invest (non-negotiable, moved first)

At your stage, consider 50/20/30 — savings second, not third.

### Why This Works
Your brain treats whatever lands in your account as "available to spend." Once savings are moved first, your spending brain never sees it.

### Practical Steps
1. Open a separate savings account (different bank helps)
2. On every payment/income, transfer 20% before touching the rest
3. Never touch the savings account for non-emergencies
4. Track your "savings rate" monthly — this is a more important number than your income

### The Emergency Fund First
Before investing anything, build 3 months of living expenses as cash. This prevents you from selling investments at the worst time when life happens.`,
      quiz: {
        questions: [
          {
            prompt: 'In the Pay-Yourself-First rule, when do you move money to savings?',
            options: JSON.stringify(['After all bills are paid', 'At end of month', 'Immediately when income arrives, before spending', 'Whenever you feel like it']),
            correctIndex: 2,
          },
          {
            prompt: 'In the 50/30/20 framework, what does the 20% represent?',
            options: JSON.stringify(['Entertainment', 'Food and transport', 'Save/invest', 'Clothing']),
            correctIndex: 2,
          },
          {
            prompt: 'What should you build before you start investing?',
            options: JSON.stringify(['A stock portfolio', '3 months of emergency savings', 'A business plan', 'A credit card']),
            correctIndex: 1,
          },
        ],
      },
    },
    {
      domainId: domainMap['Business'],
      track: 'Investing Basics',
      title: 'Compound Interest: The Only Free Lunch',
      order: 1,
      content: `## Compound Interest: The Only Free Lunch

Albert Einstein allegedly called compound interest "the eighth wonder of the world." Whether he said it or not, the math is real.

### What Is It?
Compound interest means your gains earn gains. You earn interest on both your original money AND the interest already accumulated.

### Simple vs. Compound
| Year | Simple (10% on $1,000) | Compound (10% on $1,000) |
|---|---|---|
| 1 | $1,100 | $1,100 |
| 5 | $1,500 | $1,611 |
| 10 | $2,000 | $2,594 |
| 20 | $3,000 | $6,727 |
| 30 | $4,000 | $17,449 |

At year 30, simple interest gives you 4x. Compound gives you 17x.

### The Rule of 72
To estimate how long it takes to double your money: **72 ÷ interest rate = years to double**.
- At 8% returns: 72 ÷ 8 = **9 years** to double
- At 12% returns: 72 ÷ 12 = **6 years** to double

### Why Time Is Your Biggest Asset
Someone who invests $200/month from age 18 to 28 (10 years), then stops, will end up with MORE money at 65 than someone who starts at 28 and invests $200/month every single month until 65 — assuming the same return rate. Starting early > investing more, later.

### Key Principle
Compound interest requires two things: **time** and **not interrupting it**. Every time you pull money out, you reset the clock. The biggest mistake is treating investments like a savings account.`,
      quiz: {
        questions: [
          {
            prompt: 'Using the Rule of 72, how long does it take to double money at a 9% return rate?',
            options: JSON.stringify(['5 years', '8 years', '12 years', '18 years']),
            correctIndex: 1,
          },
          {
            prompt: 'What is the key difference between simple and compound interest?',
            options: JSON.stringify(['Compound has higher rates', 'Compound earns interest on accumulated interest, simple does not', 'Simple is for banks only', 'There is no real difference long-term']),
            correctIndex: 1,
          },
          {
            prompt: 'What are the two requirements for compound interest to work optimally?',
            options: JSON.stringify(['High returns and frequent withdrawals', 'Time and not interrupting compounding', 'Large principal and a financial advisor', 'Stock market knowledge and luck']),
            correctIndex: 1,
          },
        ],
      },
    },
    {
      domainId: domainMap['Business'],
      track: 'Communication & Negotiation',
      title: 'How to Negotiate Without Feeling Awkward',
      order: 1,
      content: `## How to Negotiate Without Feeling Awkward

Negotiation isn't arguing. It's collaborative problem-solving where both parties seek to understand the other's constraints before reaching an agreement.

### The Principle: Never Split the Difference
Chris Voss (former FBI hostage negotiator) showed that 50/50 compromises often leave both sides unhappy. Instead, dig until you understand *why* the other person wants what they want — then find a solution that satisfies the underlying need.

### Tactical Empathy
Before stating your position, make the other person feel heard:
- **Mirror**: Repeat the last 3 words of what they said as a question. ("...better pricing structure?")
- **Label**: "It sounds like you're concerned about quality..." They'll correct you if wrong, clarify if right — both are useful.
- **Calibrated questions**: "How am I supposed to do that?" — puts the problem back without aggression.

### The Anchoring Advantage
Whoever states a number first **anchors the negotiation**. If they anchor, counter with an extreme opposite, then move toward a pre-planned target. Never split the first anchor — the anchor is designed to make the split favor them.

### Practical Template: Selling Your Templates
When a client asks for a discount:
1. "I appreciate you saying that — what's making the price a concern?" (label + calibrated question)
2. Listen fully — is it budget? Uncertainty about value? Comparison to a competitor?
3. Address the actual concern, not the stated position.
4. "What I can do is include [bonus/custom element] at this price." — add value, don't cut price.

### Key Rule
Never negotiate against yourself. If they say "that's too expensive" and go silent — **stay silent**. Silence is not your enemy.`,
      quiz: {
        questions: [
          {
            prompt: 'What is "tactical empathy" in negotiation?',
            options: JSON.stringify(['Pretending to agree with everything', 'Making the other person feel heard to uncover their real concerns', 'Being emotionally detached', 'Offering concessions immediately']),
            correctIndex: 1,
          },
          {
            prompt: 'When a client says your price is too high and then goes silent, what should you do?',
            options: JSON.stringify(['Immediately offer a discount', 'Explain your costs in detail', 'Stay silent — do not negotiate against yourself', 'End the conversation']),
            correctIndex: 2,
          },
          {
            prompt: 'What is the anchoring advantage in negotiation?',
            options: JSON.stringify(['The person who speaks loudest wins', 'Whoever states a number first sets the reference point for the entire negotiation', 'Always offer the middle ground', 'Anchoring only works in formal contracts']),
            correctIndex: 1,
          },
        ],
      },
    },

    // ── CODING TRACKS ─────────────────────────────────────────────────────────
    {
      domainId: domainMap['Coding'],
      track: 'JavaScript Fundamentals',
      title: 'Functions, Scope, and Closures',
      order: 1,
      content: `## Functions, Scope, and Closures

These three concepts separate beginner JS from someone who can actually build things.

### Functions Are First-Class
In JavaScript, functions are values. You can assign them to variables, pass them as arguments, and return them from other functions.

\`\`\`js
const greet = (name) => \`Hello, \${name}\`
const runTwice = (fn, arg) => { fn(arg); fn(arg); }
runTwice(console.log, 'FORGE') // logs twice
\`\`\`

### Scope: Where Variables Live
- **Global scope**: accessible everywhere (avoid polluting this)
- **Function scope**: \`var\` is function-scoped (legacy, avoid)
- **Block scope**: \`let\` and \`const\` are block-scoped (use these)

\`\`\`js
function example() {
  let x = 10  // only exists inside this function
  if (true) {
    let y = 20  // only exists inside this block
    console.log(x + y) // 30 ✓
  }
  console.log(y) // ReferenceError ✗
}
\`\`\`

### Closures: Functions That Remember
A closure is a function that **retains access to its outer scope** even after the outer function has returned.

\`\`\`js
function makeCounter() {
  let count = 0
  return function() {
    count++
    return count
  }
}

const counter = makeCounter()
console.log(counter()) // 1
console.log(counter()) // 2
console.log(counter()) // 3
// count is private — nothing outside can touch it
\`\`\`

### Why This Matters
Closures power: React hooks (useState holds state between renders), event listeners that remember context, module patterns that hide private data.

### Exercise
Write a \`makeMultiplier(n)\` function that returns a new function. That new function, when called with a number \`x\`, returns \`x * n\`. Test: \`makeMultiplier(3)(7)\` should return \`21\`.`,
      quiz: {
        questions: [
          {
            prompt: 'What is a closure in JavaScript?',
            options: JSON.stringify(['A function with no return value', 'A function that retains access to its outer scope after the outer function returns', 'A way to close browser tabs', 'A type of loop']),
            correctIndex: 1,
          },
          {
            prompt: 'What is the difference between var and let in terms of scope?',
            options: JSON.stringify(['No difference', 'var is block-scoped, let is function-scoped', 'let is block-scoped, var is function-scoped', 'let only works in strict mode']),
            correctIndex: 2,
          },
          {
            prompt: 'What does makeMultiplier(3)(7) return if makeMultiplier(n) returns a function that multiplies its argument by n?',
            options: JSON.stringify(['10', '3', '21', 'undefined']),
            correctIndex: 2,
          },
        ],
      },
    },
    {
      domainId: domainMap['Coding'],
      track: 'JavaScript Fundamentals',
      title: 'Async JavaScript: Promises and Async/Await',
      order: 2,
      content: `## Async JavaScript: Promises and Async/Await

JavaScript runs on a single thread. Async programming lets you wait for slow operations (API calls, file reads) without freezing everything else.

### The Problem: Callback Hell
Old approach — nested callbacks become unreadable fast:
\`\`\`js
getUser(id, (user) => {
  getPosts(user.id, (posts) => {
    getComments(posts[0].id, (comments) => {
      // 4 levels deep and growing...
    })
  })
})
\`\`\`

### Promises: Structured Async
A Promise represents a value that will be available in the future.
\`\`\`js
fetch('https://api.example.com/data')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err))
\`\`\`

### Async/Await: Sync-Looking Async
\`\`\`js
async function getData() {
  try {
    const res = await fetch('https://api.example.com/data')
    const data = await res.json()
    console.log(data)
  } catch (err) {
    console.error(err)
  }
}
\`\`\`
\`await\` pauses execution inside the async function until the Promise resolves — but the rest of the app keeps running.

### Parallel Execution
\`\`\`js
// Sequential (slow — waits for each)
const a = await fetchA()
const b = await fetchB()

// Parallel (fast — both start immediately)
const [a, b] = await Promise.all([fetchA(), fetchB()])
\`\`\`

### Key Rule
Every \`await\` must be inside an \`async\` function. Every async function returns a Promise, even if you don't explicitly return one.`,
      quiz: {
        questions: [
          {
            prompt: 'What does Promise.all([fetchA(), fetchB()]) do compared to sequential awaits?',
            options: JSON.stringify(['Runs them one after another', 'Runs both simultaneously and waits for both to finish', 'Only runs the first one that resolves', 'Throws an error if either fails silently']),
            correctIndex: 1,
          },
          {
            prompt: 'What does await do inside an async function?',
            options: JSON.stringify(['Blocks the entire browser', 'Pauses execution of that function until the Promise resolves, while the rest of the app keeps running', 'Cancels the Promise', 'Converts the function to synchronous']),
            correctIndex: 1,
          },
          {
            prompt: 'What does every async function return?',
            options: JSON.stringify(['undefined', 'A string', 'A Promise', 'A callback']),
            correctIndex: 2,
          },
        ],
      },
    },
    {
      domainId: domainMap['Coding'],
      track: 'Python Fundamentals',
      title: 'Python Basics: Data Types and Control Flow',
      order: 1,
      content: `## Python Basics: Data Types and Control Flow

Python's readability is its superpower. Less syntax noise means you can focus on logic.

### Core Data Types
\`\`\`python
# Numbers
age = 17
height = 1.82
complex_num = 2 + 3j

# Strings
name = "Mikiyas"
multi = """
This spans
multiple lines
"""

# Booleans
is_studying = True
exam_passed = False

# Collections
domains = ["Workout", "Study", "Coding"]  # list — ordered, mutable
colors = {"Workout": "#f97316", "Study": "#3b82f6"}  # dict — key-value
unique = {1, 2, 3, 2}  # set — no duplicates → {1, 2, 3}
coords = (40.7, -74.0)  # tuple — ordered, immutable
\`\`\`

### Control Flow
\`\`\`python
# If/elif/else
score = 85
if score >= 90:
    grade = "A"
elif score >= 70:
    grade = "B"
else:
    grade = "C"

# For loops
for domain in domains:
    print(f"Working on: {domain}")

# While
streak = 0
while streak < 14:
    streak += 1
print(f"Locked in at {streak} days!")

# List comprehensions — Python's most distinctive feature
squared = [x**2 for x in range(10)]
study_days = [d for d in domains if "Study" in d]
\`\`\`

### Functions
\`\`\`python
def compute_xp(minutes: int, weight: float, base_rate: int = 10) -> int:
    return round(minutes * weight * base_rate)

result = compute_xp(45, 1.5)  # 675
\`\`\`

Type hints are optional but make code self-documenting. Use them.`,
      quiz: {
        questions: [
          {
            prompt: 'What is the output of: {1, 2, 3, 2, 1}?',
            options: JSON.stringify(['{1, 2, 3, 2, 1}', '[1, 2, 3]', '{1, 2, 3}', 'Error']),
            correctIndex: 2,
          },
          {
            prompt: 'What does [x**2 for x in range(4)] produce?',
            options: JSON.stringify(['[1, 4, 9, 16]', '[0, 1, 4, 9]', '[0, 2, 4, 6]', '[1, 2, 3, 4]']),
            correctIndex: 1,
          },
          {
            prompt: 'What is the difference between a list and a tuple in Python?',
            options: JSON.stringify(['No difference', 'Lists use () and tuples use []', 'Lists are mutable, tuples are immutable', 'Tuples can hold more items']),
            correctIndex: 2,
          },
        ],
      },
    },

    // ── WORKOUT ───────────────────────────────────────────────────────────────
    {
      domainId: domainMap['Workout'],
      track: '24-Week Bodybuilding Program',
      title: 'Phase 1 (Weeks 1–6): Foundation & Form',
      order: 1,
      content: `## Phase 1 (Weeks 1–6): Foundation & Form

Before loading heavy, you need movement patterns so ingrained they're automatic. Phase 1 builds this foundation and primes tendons and joints for the loads ahead.

### Training Split (5 days/week)
| Day | Focus |
|---|---|
| Monday | Push (Chest, Shoulders, Triceps) |
| Tuesday | Pull (Back, Biceps) |
| Wednesday | Legs (Quads, Hamstrings, Glutes) |
| Thursday | Rest / Active recovery |
| Friday | Push (volume day) |
| Saturday | Pull + Arms |
| Sunday | Rest |

### Monday — Push Day
| Exercise | Sets | Reps | Rest |
|---|---|---|---|
| Barbell Bench Press | 4 | 10–12 | 90s |
| Incline DB Press | 3 | 12 | 75s |
| Overhead Press | 3 | 10–12 | 90s |
| Lateral Raises | 3 | 15 | 60s |
| Tricep Pushdown | 3 | 15 | 60s |

### Tuesday — Pull Day
| Exercise | Sets | Reps | Rest |
|---|---|---|---|
| Deadlift | 4 | 6–8 | 2min |
| Pull-ups / Lat Pulldown | 4 | 8–10 | 90s |
| Seated Cable Row | 3 | 12 | 75s |
| Face Pulls | 3 | 15 | 60s |
| Barbell Curl | 3 | 12 | 60s |

### Wednesday — Legs
| Exercise | Sets | Reps | Rest |
|---|---|---|---|
| Squat | 4 | 8–10 | 2min |
| Romanian Deadlift | 3 | 10–12 | 90s |
| Leg Press | 3 | 15 | 75s |
| Leg Curl | 3 | 12 | 60s |
| Calf Raises | 4 | 20 | 45s |

### Phase 1 Rules
- **Progressive overload**: add 2.5kg or 1 more rep each week minimum
- **Form over load**: if form breaks, drop weight 10%
- **Log every session**: weight used, reps completed — this data feeds your AI planner
- **Protein target**: 1.8–2.2g per kg of bodyweight per day — non-negotiable for muscle growth

### Track This Week's Numbers Here
Log your session using the timer, then note your working weights in the session notes field.`,
      quiz: {
        questions: [
          {
            prompt: 'What is progressive overload?',
            options: JSON.stringify(['Lifting maximum weight every session', 'Adding weight or reps incrementally over time to force adaptation', 'Training 7 days a week', 'Using supplements to recover faster']),
            correctIndex: 1,
          },
          {
            prompt: 'What is the recommended minimum protein intake for muscle growth?',
            options: JSON.stringify(['0.8g per kg bodyweight', '1.0g per kg bodyweight', '1.8–2.2g per kg bodyweight', '3g per kg bodyweight']),
            correctIndex: 2,
          },
          {
            prompt: 'If your form breaks during a set, what should you do?',
            options: JSON.stringify(['Push through — form improves with practice', 'Drop weight by 10% and complete the set properly', 'Stop training for the day', 'Switch to a machine immediately']),
            correctIndex: 1,
          },
        ],
      },
    },
  ]

  for (const lesson of lessons) {
    const { quiz, ...lessonData } = lesson
    const created = await prisma.lesson.create({ data: lessonData })

    if (quiz) {
      const createdQuiz = await prisma.quiz.create({
        data: { lessonId: created.id },
      })
      for (const q of quiz.questions) {
        await prisma.quizQuestion.create({
          data: { quizId: createdQuiz.id, ...q },
        })
      }
    }
  }
}

async function main() {
  console.log('🌱 Seeding FORGE database...')

  // Domains
  const domainMap: Record<string, string> = {}
  for (const d of DOMAINS) {
    const domain = await prisma.domain.upsert({
      where: { id: d.name.toLowerCase() },
      update: d,
      create: { id: d.name.toLowerCase(), ...d },
    })
    domainMap[d.name] = domain.id
    console.log(`  ✓ Domain: ${d.name}`)
  }

  // User profile (placeholder exam date — update in /settings)
  await prisma.userProfile.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      examDate: new Date('2027-03-15'),
      planStartDate: new Date(),
    },
  })
  console.log('  ✓ UserProfile (exam date: March 15, 2027 — update in /settings)')

  // Books
  for (const book of BOOKS) {
    await prisma.book.upsert({
      where: { id: `book-${book.order}` },
      update: book,
      create: { id: `book-${book.order}`, ...book },
    })
  }
  console.log(`  ✓ ${BOOKS.length} books seeded`)

  // Scripture plan
  for (let i = 0; i < NT_PLAN.length; i++) {
    await prisma.scripturePlanItem.upsert({
      where: { id: `scripture-${i + 1}` },
      update: { reference: NT_PLAN[i], order: i + 1 },
      create: { id: `scripture-${i + 1}`, reference: NT_PLAN[i], order: i + 1 },
    })
  }
  console.log(`  ✓ ${NT_PLAN.length} scripture plan items seeded`)

  // Starter habits (4 slots filled with domain-spread defaults)
  const starterHabits = [
    { domainId: domainMap['Workout'], name: 'Gym session (≥45 min)' },
    { domainId: domainMap['Study'], name: 'Study block (≥60 min)' },
    { domainId: domainMap['Faith'], name: 'Bible reading + check-in' },
    { domainId: domainMap['Coding'], name: 'Code for 30 min minimum' },
  ]
  for (const h of starterHabits) {
    await prisma.habit.create({ data: h })
  }
  console.log('  ✓ 4 starter habits created')

  // Notification preferences singleton
  await prisma.notificationPreference.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  })

  // Lessons + quizzes
  await seedLessons(domainMap)
  console.log('  ✓ Lessons and quizzes seeded')

  console.log('\n✅ FORGE database seeded successfully!')
  console.log('   Remember to update your exam date in /settings')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
