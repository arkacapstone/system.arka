# ARKA Debug Study Guide (parang dictionary)

Gabay ito para maintindihan mo ang **flow** ng code, kung saan ang **frontend** at **backend**, at ang **OOP** nito. Para kapag pinag-debug ka, alam mo agad **saan titingin** at **ano ang nawala o nabago**.

> Paano gamitin: basahin muna ang **Part 1–2** (mapa at flow). Gamitin ang **Part 3–4** bilang dictionary. Sa defense, diretso sa **Part 5–7** (ang 3 klase ng error at checklist).

---

## Part 1. Ang Mapa: Frontend vs Backend

Ang ARKA ay **Laravel (PHP) sa backend** + **React (JSX) sa frontend**, at pinagdudugtong sila ng **Inertia.js**.

```
 BROWSER (Frontend: React .jsx)            SERVER (Backend: Laravel .php)            DATABASE (MySQL)
 ┌────────────────────────────┐   HTTP    ┌──────────────────────────────────┐  SQL  ┌──────────────┐
 │ resources/js/Pages/*.jsx   │ ───────▶  │ routes → middleware → controller │ ────▶ │ tables       │
 │ (form, button, table)      │           │   → action/service → model       │       │ (users, ...) │
 │                            │ ◀───────  │ Inertia::render('Page', props)   │ ◀──── │              │
 └────────────────────────────┘   props   └──────────────────────────────────┘ rows  └──────────────┘
```

### Saan ang ano (folder dictionary)

| Folder / File | Frontend o Backend? | Ano ang laman | Wika |
|---|---|---|---|
| `resources/js/Pages/` | **Frontend** | Ang mga buong page (hal. `Employee/Leave.jsx`) | JSX (React) |
| `resources/js/Components/` | **Frontend** | Maliliit na parte na paulit-ulit gamitin (button, table, dialog) | JSX |
| `resources/js/Layouts/` | **Frontend** | Balangkas ng page (sidebar, header) — `AppLayout.jsx` | JSX |
| `resources/js/lib/` | **Frontend** | Helper functions (hal. `format.js` para sa date) | JS |
| `resources/js/app.jsx` | **Frontend** | Simula ng React; dito hinahanap ang page sa `./Pages/{name}.jsx` | JSX |
| `resources/css/` | **Frontend** | Styles (Tailwind) | CSS |
| `resources/views/app.blade.php` | Tulay | Ang iisang HTML shell kung saan ini-mount ang React | Blade |
| `routes/*.php` | **Backend** | Listahan ng URL → aling controller ang tatawagin | PHP |
| `bootstrap/app.php` | **Backend** | Setup: middleware aliases (`role`, `view`), routing | PHP |
| `app/Http/Middleware/` | **Backend** | "Guard" bago pumasok sa controller (naka-login ba? tamang role?) | PHP |
| `app/Http/Controllers/` | **Backend** | Tumatanggap ng request, nag-validate, nagpapasa sa Action, nagbabalik ng page | PHP |
| `app/Http/Requests/` | **Backend** | Validation rules na hiwalay na class (Form Request) | PHP |
| `app/Actions/` | **Backend** | Isang gawain/business rule (hal. `SubmitLeaveRequest`) | PHP |
| `app/Services/` | **Backend** | Mas malalaking logic/computation (payroll, reports, dashboard) | PHP |
| `app/Models/` | **Backend** | Representasyon ng table sa database (Eloquent) | PHP |
| `app/Models/Concerns/` | **Backend** | Traits na shared ng maraming model | PHP |
| `app/Enums/` | **Backend** | Fixed na listahan ng values (status, role) | PHP |
| `app/Notifications/` | **Backend** | Mga notification/email na pinapadala | PHP |
| `app/Console/Commands/` | **Backend** | Scheduled/CLI tasks (hal. `StopFinishedShifts`) | PHP |
| `database/migrations/` | **Backend/DB** | Gumagawa ng tables at columns | PHP |
| `database/seeders/`, `factories/` | **Backend/DB** | Sample data | PHP |
| `tests/Feature/` | Testing | Automated tests (hal. `Employee/LeaveRequestTest.php`) | PHP |
| `storage/logs/laravel.log` | **Backend** | **Dito lumalabas ang backend errors** | text |

**Mabilis na tanda:**
- `.jsx` / `.js` = **Frontend** (tumatakbo sa browser).
- `.php` = **Backend** (tumatakbo sa server).
- Kung ang error ay nasa **browser console (F12)** → malamang frontend.
- Kung ang error ay **pulang Laravel error page** o nasa `laravel.log` → backend.

---

## Part 2. Ang Flow ng Isang Request (Halimbawa: Mag-file ng Leave)

Sundan natin ang totoong code. Ang contractor ay pupunta sa Leave page at magpa-file ng leave.

### A. Pagbukas ng page (GET `/employee/leave`)

| # | Ano ang nangyayari | Saang file | F/B |
|---|---|---|---|
| 1 | Pumunta ang user sa `/employee/leave` | browser | F |
| 2 | Hinanap ng Laravel ang route: `Route::get('/', 'index')` sa loob ng `prefix('leave')` | `routes/employee.php:46-50` | B |
| 3 | Dumaan sa middleware: `auth` (naka-login?), `verified`, `role:contractor,company_admin` (tamang role?), `view:employee` | `routes/employee.php:18`, `app/Http/Middleware/EnsureUserHasRole.php` | B |
| 4 | Dumaan din sa global web middleware (active ba ang account, napalitan na ba ang password, kumpleto ba ang profile) | `bootstrap/app.php` → `withMiddleware` | B |
| 5 | Tinawag ang `LeaveRequestController@index` — kinuha ang leave requests ng user sa DB | `app/Http/Controllers/Employee/LeaveRequestController.php:23` | B |
| 6 | Ginawang array ang data (`'startDate' => ...`) at ipinasa sa `Inertia::render('Employee/Leave', [...])` | `LeaveRequestController.php:54` | B |
| 7 | Nagdagdag ng **shared props** (auth user, flash message, navigation) | `app/Http/Middleware/HandleInertiaRequests.php:34` | B |
| 8 | Sa browser, hinanap ng Inertia ang `./Pages/Employee/Leave.jsx` | `resources/js/app.jsx` (`resolve`) | F |
| 9 | Ni-render ang `Leave({ requests, filters, reasons, statuses })` — ang props ay galing sa step 6 | `resources/js/Pages/Employee/Leave.jsx:116` | F |

> **Mahalaga:** ang pangalan ng props sa PHP (`'requests' => ...`) ay **dapat kapareho** ng nasa JSX (`{ requests }`). Kapag nagkaiba, `undefined` ang makukuha sa frontend.

### B. Pag-submit ng form (POST `/employee/leave`)

| # | Ano ang nangyayari | Saang file | F/B |
|---|---|---|---|
| 1 | Nag-fill ang user; naka-store ang values sa `useForm({...})` | `Leave.jsx:40` | F |
| 2 | Pinindot ang Submit → `onSubmit={submit}` → `post(route('employee.leave.store'))` | `Leave.jsx:50-65` | F |
| 3 | Ang `route('employee.leave.store')` (Ziggy) ay nagiging URL `/employee/leave` | `routes/employee.php:48` (`->name('store')`) | F→B |
| 4 | Tinawag ang `LeaveRequestController@store` | `LeaveRequestController.php:66` | B |
| 5 | **Validation**: `$request->validate([...])`. Kapag mali, babalik agad sa page na may `errors` | `LeaveRequestController.php:68` | B |
| 6 | Ipinasa sa **Action**: `$submit->handle($request->user(), [...], $file)` | `LeaveRequestController.php:81` | B |
| 7 | **Business rule**: kung `client_informed` pero walang proof → `NeedsVerification` | `app/Actions/Leave/SubmitLeaveRequest.php:31` | B |
| 8 | Nag-save sa DB gamit ang relationship: `$employee->leaveRequests()->create([...])` | `SubmitLeaveRequest.php:33` → `app/Models/User.php:330` | B→DB |
| 9 | Habang nag-sa-save, tumakbo ang trait hook (`saving`) na sinisigurong may `contractors` row | `app/Models/Concerns/BelongsToContractor.php` | B |
| 10 | Nag-log ng activity at nag-notify sa Super Admins | `SubmitLeaveRequest.php:44-45`, `app/Services/Notifier.php` | B |
| 11 | `return back()->with('success', '...')` → bumalik sa page na may flash message | `LeaveRequestController.php:90` | B |
| 12 | Lumabas ang toast dahil binasa ng `FlashToast` ang `flash.success` | `resources/js/Components/Console/Flash.jsx` | F |
| 13 | Ang `errors.start_date` atbp. ay ipinapakita sa ilalim ng bawat field | `Leave.jsx` (`error={errors.start_date}`) | F |

**Isang linya para tandaan:**
`JSX form → route() → routes/*.php → middleware → Controller (validate) → Action (rules) → Model (DB) → back()/Inertia::render → JSX`

Halos lahat ng ibang module (overtime, cash advance, devotional, attendance) ay **parehong pattern**. Palitan mo lang ang pangalan.

---

## Part 3. OOP Dictionary (may totoong halimbawa sa ARKA)

| Termino | Simpleng ibig sabihin | Halimbawa sa ARKA |
|---|---|---|
| **Class** | "Blueprint" o hulmahan | `class SubmitLeaveRequest` sa `app/Actions/Leave/SubmitLeaveRequest.php` |
| **Object / Instance** | Ang aktwal na bagay na ginawa mula sa class | `$leave` (isang `LeaveRequest` object), `$request->user()` (isang `User` object) |
| **Property** | Variable na nasa loob ng class | `private readonly ActivityLogger $activity` |
| **Method** | Function na nasa loob ng class | `handle()`, `cancel()`, `leaveType()` |
| **Constructor** | Method na unang tumatakbo pag ginawa ang object | `public function __construct(private readonly ActivityLogger $activity, ...)` |
| **Encapsulation** | Itinatago ang loob; `private` = bawal gamitin sa labas | `private function leaveType()` — sa loob lang ng `SubmitLeaveRequest` |
| **Access modifiers** | `public` (kahit sino), `protected` (class + anak), `private` (class lang) | `protected function casts()` sa models |
| **Inheritance (`extends`)** | Anak na class na nagmana sa magulang | `class LeaveRequest extends Model`, `class User extends Authenticatable`, `LeaveRequestController extends Controller` |
| **Interface (`implements`)** | "Kontrata": listahan ng methods na DAPAT meron | `interface Report` → `class LeaveReport implements Report`; `interface DashboardWidget` → `AlertsWidget implements DashboardWidget` |
| **Polymorphism** | Iba-ibang class, parehong method name, iba ang laman | Lahat ng `*Report` ay may `title()` pero iba-iba ang sagot (`'Leave Summary'`, atbp.) |
| **Abstraction** | Ginagamit mo nang hindi kailangang alam ang loob | Tinatawag ng controller ang `$submit->handle(...)` nang hindi alam kung paano nag-save |
| **Trait (`use`)** | Piraso ng code na "kinokopya" sa maraming class | `use BelongsToContractor` sa `LeaveRequest` (`app/Models/Concerns/`) |
| **Enum** | Fixed na pagpipilian, hindi basta string | `enum LeaveRequestStatus` (`PendingApproval`, `Approved`, ...), `enum UserRole` |
| **Static method** | Tinatawag sa class mismo, hindi sa object (`::`) | `LeaveType::create(...)`, `LeaveRequestStatus::options()`, `Contractor::ensureFor($id)` |
| **Constant** | Hindi nagbabagong value | `LeaveRequestController::REASONS`, `User::INVITATION_VALID_DAYS` |
| **Dependency Injection** | Hindi mo ginagawa ang object; ibinibigay ito ni Laravel | `store(Request $request, SubmitLeaveRequest $submit)` — kusang ginawa ni Laravel ang `$submit` |
| **Type hint / Return type** | Sinasabi kung anong uri ang papasok/lalabas | `handle(User $employee, ...): LeaveRequest` |
| **Nullable (`?`)** | Pwedeng `null` | `?UploadedFile $proof = null` |
| **Null-safe (`?->`)** | Hindi mag-e-error kahit null | `$leave->leaveType?->is_paid`, `$proof?->store(...)` |
| **`$this`** | "Ako mismong object na ito" | `$this->activity->log(...)` |
| **`self::`** | "Ang class na ito" (static) | `self::REASONS`, `self::PendingApproval` |
| **`->` vs `::`** | `->` para sa object, `::` para sa class/static/enum | `$leave->status` vs `LeaveRequestStatus::Approved` |
| **Namespace** | "Address" ng class para walang banggaan | `namespace App\Actions\Leave;` |
| **`use` (sa itaas ng file)** | "Import" ng class mula sa ibang namespace | `use App\Models\LeaveRequest;` |

### Mga layer at bakit hiwalay (Separation of Concerns)

| Layer | Tanong na sinasagot | Halimbawa |
|---|---|---|
| Route | "Anong URL?" | `routes/employee.php` |
| Middleware | "Pwede ka bang pumasok?" | `EnsureUserHasRole` |
| Controller | "Ano ang hiningi, at tama ba ang input?" | `LeaveRequestController` |
| Action | "Ano ang business rule?" | `SubmitLeaveRequest` |
| Service | "Paano kalkulahin?" | `PayrollCalculator`, `AttendanceCalculator` |
| Model | "Paano i-save/kunin sa DB?" | `LeaveRequest`, `User` |
| Enum | "Ano ang pwedeng values?" | `LeaveRequestStatus` |
| Page/Component | "Paano ipapakita?" | `Leave.jsx` |

---

## Part 4. Laravel + React Dictionary

### Backend (Laravel/PHP)

| Termino | Ibig sabihin | Saan makikita |
|---|---|---|
| **Route** | Pagkonekta ng URL sa controller method | `Route::post('/', 'store')->name('store')` |
| **Route name** | Palayaw ng route para tawagin sa JSX | `employee.leave.store` |
| **Route model binding** | `{leave}` sa URL → kusang nagiging `LeaveRequest $leave` | `Route::post('{leave}/cancel', ...)` + `cancel(..., LeaveRequest $leave)` |
| **Middleware** | Pansala bago ang controller | `auth`, `role:...`, `view:employee` |
| **Controller** | Tumatanggap ng request | `app/Http/Controllers/` |
| **`$request->validate()`** | Sinusuri ang input; kapag mali, may `errors` pabalik | `LeaveRequestController.php:68` |
| **Form Request** | Validation na nasa sariling class | `app/Http/Requests/` |
| **Action** | Isang business task | `app/Actions/` |
| **Service** | Mas malaking logic | `app/Services/` |
| **Model (Eloquent)** | Class na katumbas ng table | `app/Models/LeaveRequest.php` ↔ table `leave_requests` |
| **`#[Fillable([...])]`** | Mga column na pwedeng i-mass-assign sa `create()` | itaas ng bawat model |
| **`casts()`** | Pag-convert ng column (date, boolean, enum) | `'status' => LeaveRequestStatus::class` |
| **Relationship** | Koneksyon ng tables | `hasMany` (`User::leaveRequests()`), `belongsTo` (`LeaveRequest::leaveType()`) |
| **Scope** | Reusable na filter sa query | `#[Scope] pending()` sa `LeaveRequest`; global scope `home_office` sa trait |
| **Migration** | Gumagawa ng table/column | `database/migrations/` |
| **`Inertia::render()`** | Ipadala ang page + props sa React | dulo ng `index()` |
| **`back()->with('success', ...)`** | Bumalik sa page na may flash message | dulo ng `store()` |
| **`abort_unless(..., 404)`** | Itigil kapag hindi pasado ang kondisyon | `LeaveRequestController.php` sa `cancel()` |
| **Notification** | Mensahe/email sa user | `app/Notifications/` |
| **`dd($var)`** | "Dump and die" — ipakita ang laman at itigil | gamitin pansamantala sa debug |
| **`Log::info($var)`** | Isulat sa `storage/logs/laravel.log` | debug nang hindi tumitigil |

### Frontend (React/Inertia/JSX)

| Termino | Ibig sabihin | Saan makikita |
|---|---|---|
| **Component** | Function na nagbabalik ng JSX (UI) | `function LeaveForm(...)`, `export default function Leave(...)` |
| **Props** | Data na ipinasa sa component (galing PHP para sa Pages) | `Leave({ requests, filters, reasons, statuses })` |
| **State (`useState`)** | Data na nagbabago sa page | `const [formOpen, setFormOpen] = useState(...)` |
| **`useForm`** | Inertia helper para sa form data, errors, processing | `Leave.jsx:40` |
| **`setData('field', value)`** | Palitan ang isang field sa form | `onChange={(e) => setData('start_date', e.target.value)}` |
| **`post(route(...))`** | Ipadala ang form sa backend | `Leave.jsx:52` |
| **`router.get/post`** | Mag-request nang walang form | `router.post(route('employee.leave.cancel', id))` |
| **`route('name')`** | Gawing URL ang route name (Ziggy) | `route('employee.leave.store')` |
| **`errors.field`** | Validation error galing sa `validate()` | `error={errors.start_date}` |
| **`usePage().props`** | Kunin ang shared props (auth, flash) | `Flash.jsx` |
| **`import` / `export default`** | Pagkuha/pagbigay ng component sa ibang file | itaas/baba ng bawat `.jsx` |
| **`@/`** | Shortcut para sa `resources/js/` | `import AppLayout from '@/Layouts/AppLayout'` |
| **`className`** | Ang `class` sa HTML (Tailwind styles) | lahat ng JSX |
| **`.map()`** | Ulitin para sa bawat item sa listahan | `reasons.map(...)` |
| **`console.log(x)`** | Ipakita ang laman sa browser console (F12) | debug sa frontend |

---

## Part 5. Ang 3 Klase ng Error

### Mabilis na paghahambing

| | **Syntax Error** | **Runtime Error** | **Logic Error** |
|---|---|---|---|
| Ano ito | Mali ang **pagkakasulat** (grammar ng code) | Tama ang sulat, pero **nag-crash habang tumatakbo** | Tumatakbo, walang error, pero **mali ang resulta** |
| Kailan lumalabas | Bago pa tumakbo / pagbukas pa lang ng file | Kapag naabot ang linyang may problema | Kapag tiningnan mo ang output/data |
| May error message? | **Oo**, may line number | **Oo**, may line number at stack trace | **Wala!** Kailangan mong hanapin |
| Hirap | Pinakamadali | Katamtaman | Pinakamahirap |
| Paano mahanap | Basahin ang message + line number | Basahin ang message, tingnan ang stack trace, `dd()` | Ihambing ang **inaasahan vs nangyari**, `dd()`, tests |

---

### 5.1 SYNTAX ERRORS (mali ang pagkakasulat)

**Saan lumalabas:**
- PHP (backend): pulang Laravel page → `ParseError: syntax error, unexpected ...` + file + line. O patakbuhin: `php -l app/Path/File.php`.
- JSX (frontend): sa terminal ng `npm run dev` / `npm run build` o sa browser overlay ng Vite → `[plugin:vite:react-babel] Unexpected token (52:8)`.

**Tip:** madalas ang tunay na mali ay **isang linya BAGO** ang sinabing line number (hal. kulang ang `;` sa itaas).

| Ano ang nawala/nabago | PHP halimbawa (mali → tama) | Error na lalabas |
|---|---|---|
| Kulang ang `;` | `$leave = $submit->handle(...)` → `...);` | `syntax error, unexpected token "return"` |
| Kulang ang `$` sa variable | `validated['paid']` → `$validated['paid']` | `syntax error, unexpected token "["` |
| Kulang ang `}` o `)` | `function cancel(...) { ...` (walang `}`) | `syntax error, unexpected end of file` |
| Kulang ang `,` sa array | `'paid' => true 'reason' => ...` | `unexpected single-quoted string` |
| Mali ang `=>` | `'paid' = true` sa array | `syntax error, unexpected token "="` |
| Mali ang quotes | `'Leave request submitted.` (walang closing `'`) | `unexpected end of file` / kakaibang token |
| `->` naging `.` o `-` | `$request.user()` | `syntax error` o `Call to undefined function user()` |
| Mali ang spelling ng keyword | `pubic function`, `retrun` | `syntax error, unexpected identifier` |
| Nawala ang `<?php` sa itaas | — | Lalabas ang code mismo bilang text |

| Ano ang nawala/nabago | JSX halimbawa (mali → tama) | Error na lalabas |
|---|---|---|
| Hindi naisara ang tag | `<div>` na walang `</div>` | `Expected corresponding JSX closing tag for <div>` |
| Kulang ang `{` `}` | `value=data.reason` → `value={data.reason}` | `Unexpected token` |
| Dalawang root element | `return (<A/><B/>)` → balutin sa `<>...</>` | `Adjacent JSX elements must be wrapped` |
| Kulang ang `)` sa `.map(` | `options.map((x) => (...)` | `Unexpected token` |
| Mali ang import path | `'@/Components/Console/Feild'` | `Failed to resolve import` (build error) |

---

### 5.2 RUNTIME ERRORS (nag-crash habang tumatakbo)

**Saan lumalabas:**
- Backend: pulang Laravel error page (kapag `APP_DEBUG=true`), o `storage/logs/laravel.log`. Basahin ang **unang linya** (ang message) at ang **unang file na nasa `app/`** sa stack trace.
- Frontend: blangkong page / sira ang page → buksan ang **browser console (F12 → Console)**: `TypeError: Cannot read properties of undefined (reading 'map')`.
- Network tab (F12 → Network): kung ang request ay **500** (backend crash), **403** (bawal), **404** (walang route/record), **419** (expired CSRF/session), **422** (validation).

| Error message | Ano ang ibig sabihin | Kadalasang sanhi / saan titingin |
|---|---|---|
| `Call to undefined method App\Models\User::leaveRequest()` | Walang ganyang method | Mali ang spelling o binura ang relationship → `app/Models/User.php` (`leaveRequests`) |
| `Call to a member function format() on null` | Ginamit ang `->` sa `null` | Walang laman ang column (hal. `start_date`), o nawala sa `casts()` |
| `Attempt to read property "is_paid" on null` | Walang related record | `$leave->leaveType->is_paid` — dapat `?->`, o walang `leave_type_id` |
| `Undefined variable $validated` | Ginamit bago ginawa / mali ang pangalan | Tingnan ang itaas ng method |
| `Undefined array key "paid"` | Walang ganyang key sa array | Mali ang key name sa `validate()` vs ginamit |
| `Class "App\Models\LeaveReqest" not found` | Mali ang pangalan o kulang ang `use` | Itaas ng file (`use ...;`) at spelling |
| `SQLSTATE[42S22]: Column not found: 1054 Unknown column 'employee_id'` | Walang ganyang column sa table | Migration vs model; tingnan `docs/arka_system_fix_log.md` §1 |
| `SQLSTATE[42S02]: Base table or view not found` | Walang table | Hindi pa na-migrate: `php artisan migrate` |
| `SQLSTATE[23000]: Integrity constraint violation` | Duplicate / foreign key / NOT NULL | Kulang ang value o maling id |
| `Add [field] to fillable property` / `MassAssignmentException` | Hindi pinayagan ang column sa `create()` | Idagdag sa `#[Fillable([...])]` ng model |
| `"x" is not a valid backing value for enum` | Value sa DB ay wala sa enum | `app/Enums/*.php` vs laman ng DB |
| `Route [employee.leave.stor] not defined` | Mali ang route name | `routes/*.php` (`->name(...)`) vs `route('...')` |
| `403 Forbidden` | Hindi tugma ang role | middleware `role:...` sa routes, `EnsureUserHasRole.php` |
| `404 Not Found` | Walang route o walang record / hindi sa iyo | URL, route binding, `abort_unless(..., 404)` |
| `Too few arguments to function handle()` | Kulang ang ipinasang argument | Tingnan ang signature ng method |
| `Page not found: ./Pages/Employee/Leav.jsx` | Mali ang pangalan sa `Inertia::render()` | Dapat tugma sa file sa `resources/js/Pages/` |
| `TypeError: Cannot read properties of undefined (reading 'map')` (JS) | Ang prop ay `undefined` | Hindi ipinasa sa `Inertia::render([...])` o mali ang pangalan ng prop |
| `X is not a function` (JS) | Tinawag ang hindi function | Mali ang import/destructure (hal. `setdata` vs `setData`) |
| `X is not defined` (JS) | Hindi na-import o na-declare | Itaas ng `.jsx` (`import ...`) |

---

### 5.3 LOGIC ERRORS (walang error, pero mali ang resulta)

**Walang error message!** Kaya ang tanong mo ay: *"Ano ang **dapat** mangyari, at ano ang **nangyari**?"* Saka mo hanapin ang linya na gumagawa ng desisyong iyon.

**Mga palatandaan na logic error:** maling total/computation, maling status, may hindi lumalabas sa listahan, lumalabas ang hindi dapat, nakakapasok ang dapat bawal, kabaligtaran ang resulta.

| Ano ang nabago | Halimbawa sa ARKA (tama → binagong mali) | Epekto |
|---|---|---|
| `&&` naging `\|\|` | `$details['client_informed'] && $proof === null` → `\|\|` | Lahat ng walang proof ay "Needs Verification" kahit hindi sinabing informed |
| `===` naging `!==` | `$proof === null` → `$proof !== null` | Baliktad: may proof pa ang na-flag |
| `>=` naging `<=` | `whereDate('end_date', '>=', $from)` → `'<='` | Mali ang filter ng date |
| `!` nawala o nadagdag | `if (! $leave->status->isOpen())` → `if ($leave->status->isOpen())` | Ang bukas na request ay hindi na ma-cancel, ang tapos na ay pwede |
| Maling enum case | `LeaveRequestStatus::Cancelled` → `::Rejected` sa `cancel()` | Ang na-withdraw ay lumalabas na "Rejected" |
| Maling ternary | `$paid ? 'Paid leave' : 'Unpaid leave'` (pinagpalit) | Baliktad ang leave type |
| Nawala ang kondisyon | Binura ang `abort_unless($leave->employee_id === $request->user()->id, 404)` | **Security bug:** pwedeng i-cancel ang leave ng iba |
| Maling role sa route | `role:contractor` naging `role:primary_admin` | Hindi makapasok ang tamang user (o nakakapasok ang mali) |
| `after_or_equal` nawala | Validation ng `end_date` | Pwedeng mas maaga ang end kaysa start |
| Off-by-one | `diffInDays()` vs `diffInDays() + 1` | Kulang ng isang araw ang bilang ng leave |
| Maling operator sa math | `+` naging `-`, o `*` naging `/` sa payroll | Maling sweldo/total (tingnan `app/Services/Payroll/PayrollCalculator.php`) |
| Maling field sa JSX | `value={data.start_date}` sa End date field | Parehong date ang ipinapakita |
| `onChange` naka-turo sa maling field | `setData('start_date', ...)` sa End date | Hindi nagbabago ang end date |
| Nawala ang `reset()` | sa `onSuccess` | Hindi nalilinis ang form pagkatapos mag-submit |

**Paano hanapin ang logic error (hakbang):**
1. Alamin ang **inaasahan** (hal. "Dapat Pending approval").
2. Hanapin kung **saang linya** napagpapasyahan iyon (`grep` ang salita, hal. `NeedsVerification`).
3. Ilagay ang `dd($needsVerification, $details, $proof);` bago ang desisyon at subukan ulit.
4. Tingnan ang mga kondisyon: `&&`/`||`, `!`, `==`/`===`, `<`/`>`/`<=`/`>=`, ternary `? :`.
5. Patakbuhin ang tests: `php artisan test --filter=LeaveRequest` — kadalasan may test na babagsak at sasabihin ang inaasahan.

---

## Part 6. "Saan Ako Titingin?" (symptom → file)

| Sintomas | Unang titingnan |
|---|---|
| Blangko ang page | Browser console (F12) → kung may red error, `resources/js/Pages/...` |
| Pulang Laravel page | Ang file + line na nasa message; `storage/logs/laravel.log` |
| 404 sa pagbukas ng page | `routes/*.php` (tama ba ang URL/prefix?) |
| 403 Forbidden | middleware `role:` sa `routes/*.php`, `app/Http/Middleware/EnsureUserHasRole.php` |
| Na-redirect sa ibang page palagi | `app/Http/Middleware/` (`EnsurePasswordIsChanged`, `EnsureProfileIsCompleted`, `EnsureAccountIsActive`) |
| Walang lumalabas na data sa table | Controller `index()` (query/filter), global scope sa `Models/Concerns/`, at pangalan ng props sa JSX |
| Hindi nagse-save | Controller `store()` → `validate()`; Action `handle()`; model `#[Fillable]` |
| Hindi lumalabas ang validation message | `errors.field` sa JSX vs pangalan ng field sa `validate()` |
| Mali ang status/kulay ng badge | `app/Enums/*Status.php` (`label()`), `StatusBadge.jsx` |
| Mali ang computation (sweldo, oras) | `app/Services/Payroll/`, `app/Services/Attendance/` |
| Walang notification | `app/Services/Notifier.php`, `app/Notifications/` |
| Hindi lumalabas ang success toast | `back()->with('success', ...)`, `HandleInertiaRequests.php` (`flash`), `Flash.jsx` |
| Mali ang sidebar/menu | `app/Support/Navigation.php` |
| "Column not found" | `database/migrations/` vs model; `docs/arka_system_fix_log.md` |

---

## Part 7. Debug Checklist at Commands

**Checklist (sundin sa pagkakasunod):**
1. **May error message ba?**
   - Oo, at "syntax/unexpected/parse" → **Syntax**. Pumunta sa line (at sa linya sa itaas nito).
   - Oo, at "undefined/null/not found/SQLSTATE/TypeError" → **Runtime**. Basahin ang unang `app/` file sa stack trace.
   - Wala, pero mali ang resulta → **Logic**. Ihambing inaasahan vs nangyari.
2. **Frontend o Backend?** `.jsx` sa error → frontend. `.php` → backend. Tingnan din ang Network tab (500 = backend).
3. **Saang layer?** Sundan ang flow sa Part 2: Page → route → middleware → controller → action/service → model → DB.
4. **Ano ang nabago?** `git diff` — ipapakita nito eksakto kung anong linya ang binago o binura.

**Mga command:**

| Command | Para saan |
|---|---|
| `git diff` | Makita kung ano ang **binago** mula sa huling commit (pinakamabilis sa debug test!) |
| `git status` | Aling files ang nabago |
| `php -l app/Path/File.php` | Check ng **syntax** ng isang PHP file |
| `npm run build` | Lalabas ang **syntax** errors ng JSX |
| `php artisan route:list --path=leave` | Makita ang routes, pangalan, at controller |
| `php artisan test` | Patakbuhin lahat ng tests |
| `php artisan test --filter=LeaveRequest` | Test ng isang module lang |
| `tail -n 50 storage/logs/laravel.log` | Huling backend errors |
| `php artisan tinker` | Subukan ang code/query nang direkta |
| `php artisan migrate:status` | Na-migrate na ba ang lahat ng tables |
| `dd($var);` (PHP) / `console.log(var)` (JS) | Silipin ang laman ng variable |

> **Tandaan:** alisin ang `dd()` at `console.log()` pagkatapos mag-debug.

---

## Part 8. Mini Practice (subukan mo)

Gumawa ng branch, sirain ang isang bagay, tapos hanapin gamit ang guide na ito:

1. **Syntax:** burahin ang `;` sa dulo ng `return back()->with(...)` sa `LeaveRequestController.php` → buksan ang Leave page. Anong message? Anong line?
2. **Runtime:** palitan ang `leaveRequests()` ng `leaveRequest()` sa `index()` → buksan ang page. Basahin ang `Call to undefined method`.
3. **Runtime (frontend):** sa `Inertia::render('Employee/Leave', ...)` palitan ang `'requests'` ng `'leaves'` → F12 Console. Bakit `undefined`?
4. **Logic:** palitan ang `&&` ng `||` sa `SubmitLeaveRequest.php:31` → mag-file ng leave na "Client informed: No" at walang proof. Anong status? Patakbuhin `php artisan test --filter=LeaveRequest`.

Ibalik lahat gamit ang `git checkout -- .` pagkatapos.
