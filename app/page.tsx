import { Button, LockedReveal, MatchBadge } from "@/components/ds";
import WaitlistForm from "@/components/WaitlistForm";
import ValueGraph from "@/components/ValueGraph";
import "./home.css";

// warm-toned portrait (golden hour) so the veiled tile reads warm, never navy
const IMG = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=75";
const GOODWAY = "https://good-way.org/pl/programy-rozwojowe/lovli";

function Nav() {
  return (
    <nav className="lv-nav">
      <div className="wrap nav-in">
        <a className="lockup" href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-symbol.svg" width="34" height="34" alt="" />
          <span className="wm">
            Lovli<span className="dot"></span>
            <span style={{ color: "var(--accent-value)" }}>IO</span>
          </span>
        </a>
        <div className="navlinks">
          <a href="#dlaczego">Dlaczego</a>
          <a href="#jak">Jak to działa</a>
          <a href="#konstelacja">Konstelacja</a>
          <a href="#zasady">Zasady</a>
          <a href="#badania">Badania</a>
          <a href="#dolacz"><Button size="sm">Dołącz</Button></a>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="wrap hero" id="top">
      <p className="eyebrow">Poznaj zanim zobaczysz</p>
      <h1>
        Najpierw <em>sens</em>.<br />
        Potem miłość.
      </h1>
      <p className="lead">
        Tu nie przesuwasz twarzy. Najpierw poznajesz wartości, cele i model szczęścia
        drugiej osoby — zdjęcie odsłaniacie razem, krok po kroku.
      </p>
      <div className="cta-row">
        <a href="#dolacz"><Button size="lg">Zacznij od wartości</Button></a>
        <a href="#jak"><Button size="lg" variant="ghost">Zobacz jak to działa</Button></a>
      </div>

      <div className="story">
        <div className="vcard">
          <span className="stamp">To widzisz najpierw</span>
          <div className="who">
            <span className="name">Anna, 29</span>
            <MatchBadge score={87} ring={false} />
          </div>
          <div className="chips">
            <span className="chip">Wolność</span>
            <span className="chip">Rodzina</span>
            <span className="chip h">Rozwój</span>
            <span className="chip">Autentyczność</span>
          </div>
          <blockquote>„Sens znajduję w tym, co trwałe — nie w tym, co błyszczy.&rdquo;</blockquote>
        </div>
        <div className="photo-side">
          <LockedReveal src={IMG} progress={55} size={132} />
          <span className="photo-note">Zdjęcie? Na końcu — jako nagroda.</span>
        </div>
      </div>
    </header>
  );
}

function Why() {
  return (
    <section id="dlaczego" className="lv-section">
      <div className="wrap why-grid">
        <div>
          <h2>Swipe&nbsp;— i co dalej?</h2>
          <p className="why-lead">
            Aplikacje randkowe nauczyły nas oceniać człowieka w półtorej sekundy —
            po zdjęciu. Efekt znasz: setki dopasowań, zero rozmów, które coś znaczą.
          </p>
        </div>
        <div className="why-points">
          <div className="wpoint">
            <h3>Lovli.IO odwraca kolejność</h3>
            <p>
              Zaczynasz od tego, co w relacji naprawdę pracuje: wartości, cele życiowe,
              styl podejmowania decyzji. Wygląd dochodzi na końcu — gdy jest już do czego.
            </p>
          </div>
          <div className="wpoint">
            <h3>To nie jest kolejna randkowa appka</h3>
            <p>
              Lovli to narzędzie edukacyjno-społeczne: uczy nazywać własne wartości,
              rozmawiać o nich i rozpoznawać, z kim faktycznie się zgadzasz —
              zanim emocje podpowiedzą skróty.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    {
      n: "01", c: "var(--accent-value)", h: "Nazwij swoje wartości",
      p: "Odpowiadasz na pytania, które mają znaczenie: co nadaje Twojemu życiu sens, czego szukasz, co jest fundamentem. Bez testu psychologicznego — w swoim tempie.",
    },
    {
      n: "02", c: "var(--accent-success)", h: "Rezonujcie ze sobą",
      p: "Widzisz ludzi przez ich wartości, nie twarze. Anonimowe rozmowy, wspólne pytania i mikro-gry pogłębiają dopasowanie — bez oceniania po wyglądzie.",
    },
    {
      n: "03", c: "var(--accent-reward)", h: "Zdjęcie jako nagroda",
      p: "Gdy dopasowanie rośnie, zdjęcie odsłania się stopniowo. Tożsamość ujawniacie dobrowolnie, oboje — najpierw człowiek, potem wygląd.",
    },
  ];
  return (
    <section id="jak" className="lv-section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <h2>Jak to działa</h2>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Trzy kroki, które odwracają kolejność znaną z aplikacji randkowych.
        </p>
        <div className="steps">
          {steps.map((s) => (
            <div className="step" key={s.n}>
              <div className="n" style={{ color: s.c }}>{s.n}</div>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Constellation() {
  return (
    <section id="konstelacja" className="lv-section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <h2>Zobacz, jak blisko są ludzie o Twoich wartościach</h2>
        <p className="vg-lead">
          Każdy punkt to osoba opisana swoimi wartościami — nie zdjęciem.
          Im bliżej siebie, tym większa zgodność. Tak wygląda przestrzeń,
          w której Lovli szuka dopasowań.
        </p>
        <ValueGraph />
        <p className="vg-note">
          Wizualizacja poglądowa na danych przykładowych — w aplikacji zobaczysz
          tu swoją prawdziwą konstelację.
        </p>
      </div>
    </section>
  );
}

function Rules() {
  const rules = [
    {
      h: "Anonimowość najpierw",
      p: "Ani imienia, ani zdjęcia na starcie. Poczucie bezpieczeństwa to warunek szczerej rozmowy o wartościach.",
    },
    {
      h: "AI nie ocenia ludzi",
      p: "Sztuczna inteligencja porządkuje wartości i proponuje pytania. Nie diagnozuje, nie klasyfikuje, nie mówi, kto jest „lepszy”.",
    },
    {
      h: "Twoje dane — Twoja decyzja",
      p: "Minimum danych, pełna kontrola: wgląd, eksport, usunięcie. Tożsamość ujawniasz tylko dobrowolnie. Zgodnie z RODO.",
    },
    {
      h: "Wygląd na końcu",
      p: "Zdjęcia odsłaniają się stopniowo, po obu stronach jednocześnie — jako efekt dopasowania, nie jego kryterium.",
    },
  ];
  return (
    <section id="zasady" className="lv-section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <h2>Zasady, których nie łamiemy</h2>
        <div className="rules">
          {rules.map((r) => (
            <div className="rule" key={r.h}>
              <h3>{r.h}</h3>
              <p>{r.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Quote() {
  return (
    <section id="filozofia" className="lv-section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="band">
          <p>„Człowiek nie dąży w gruncie rzeczy do przyjemności czy do władzy, lecz do sensu.&rdquo;</p>
          <cite>— Viktor Frankl, twórca logoterapii · fundament Lovli.IO</cite>
        </div>
      </div>
    </section>
  );
}

function Research() {
  return (
    <section id="badania" className="lv-section" style={{ paddingTop: 0 }}>
      <div className="wrap research">
        <div>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Projekt non-profit</p>
          <h2>Za Lovli stoją badania, nie algorytm zaangażowania</h2>
          <p className="res-lead">
            Lovli.IO to program rozwojowy fundacji <strong>Good&nbsp;Way</strong> i jednocześnie
            projekt badawczy: sprawdzamy, czy zgodność wartości naprawdę buduje trwalsze
            relacje niż dopasowanie po wyglądzie. Aplikacja nie ma nas uzależnić od
            przesuwania — ma pomóc wyjść z niej w dobrą relację.
          </p>
          <a href={GOODWAY} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">Poznaj projekt badawczy →</Button>
          </a>
        </div>
        <ul className="res-points">
          <li>Hipotezy badawcze postawione przed napisaniem kodu — nie odwrotnie</li>
          <li>Fundament naukowy: logoterapia i psychologia wartości</li>
          <li>Model non-profit — bez sprzedawania danych, bez płatnych „boostów”</li>
        </ul>
      </div>
    </section>
  );
}

function Fin() {
  return (
    <section id="dolacz" className="lv-section" style={{ paddingTop: 0 }}>
      <div className="wrap fin">
        <h2>Relacje z głębią zaczynają się tutaj</h2>
        <p style={{ color: "var(--text-secondary)", margin: "0 0 32px" }}>
          Aplikacja jest w budowie. Zostaw adres, a damy Ci znać, gdy ruszą
          pierwsze testy — będziesz w pierwszej grupie.
        </p>
        <WaitlistForm />
        <p className="fin-note">
          Zero spamu — jedna wiadomość o starcie. Projekt non-profit fundacji{" "}
          <a href={GOODWAY} target="_blank" rel="noopener noreferrer">Good Way</a>.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lv-footer">
      <div className="wrap foot-in">
        <span>© 2026 Lovli.IO · program fundacji Good Way</span>
        <a href={GOODWAY} target="_blank" rel="noopener noreferrer">good-way.org</a>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <Why />
      <How />
      <Constellation />
      <Rules />
      <Quote />
      <Research />
      <Fin />
      <Footer />
    </>
  );
}
