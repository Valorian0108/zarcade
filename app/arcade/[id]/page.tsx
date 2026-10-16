import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MotionPrefProvider, MotionToggle } from "@/components/motion-pref";
import { Watcher } from "@/components/watcher";
import { CrowdFigure } from "@/components/crowd-figure";
import { GAMES, glossParts, type GameEntry } from "@/lib/games";

/**
 * The room before the machine (D-078). One page per game, driven by the same
 * GAMES list as the floor, so the hub stays data-driven (D-019): a cabinet
 * click opens the room, and the room carries one button that steps inside
 * to the machine at /games/<id>.
 *
 * The room says what the game is about and what it tries to teach, plus the
 * objects you will meet on screen. It never says how to win: the sees line
 * names furniture, never choices or answers, and a test guards that.
 *
 * An entry with no room copy answers not found, so sealed games stay sealed
 * and the floor shows no dead links.
 */

interface Params {
  params: Promise<{ id: string }>;
}

type Room = GameEntry & { about: string; teaches: string; sees: string; href: string };

function findRoom(id: string): Room | null {
  const game = GAMES.find((g) => g.id === id);
  if (!game || !game.about || !game.teaches || !game.sees || !game.href) return null;
  return { ...game, about: game.about, teaches: game.teaches, sees: game.sees, href: game.href };
}

export function generateStaticParams() {
  // The rooms are pure static config, so they prerender from the same list
  // the floor renders from (D-019). Unknown ids still fall through to
  // notFound at request time.
  return GAMES.filter((g) => g.about).map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const game = findRoom(id);
  if (!game) return { title: "The arcade floor" };
  return {
    title: `${game.name}: the room`,
    description: game.about,
  };
}

export default async function GameRoomPage({ params }: Params) {
  const { id } = await params;
  const game = findRoom(id);
  if (!game) notFound();

  return (
    <MotionPrefProvider>
      <div className="gm-root gm-floor gm-room">
        <header className="gm-marquee">
          <div className="gm-brand">
            <Link className="gm-wordmark gm-wordmarkLink" href="/">
              ZARCADE
            </Link>
            <span className="gm-brandDiv" aria-hidden="true" />
            <span className="gm-gameName">{game.name}</span>
          </div>
          <div className="gm-marqueeRight">
            <MotionToggle />
          </div>
        </header>

        <main>
          <div className="gm-floorHead">
            <p className="gm-eyebrow">The room before the machine</p>
            <h1 className="gm-floorTitle">{game.name}</h1>
          </div>

          <div className="gm-roomStage">
            <div className="gm-roomFigure">
              {game.id === "crowd" ? <CrowdFigure /> : <Watcher mood="calm" width={220} />}
            </div>
            <div className="gm-roomCopy">
              <p className="gm-roomAbout">{game.about}</p>
              <p className="gm-eyebrow gm-roomLabel">What it teaches</p>
              <p className="gm-roomText">
                {glossParts(game.teaches).map((part, i) =>
                  part.gloss ? (
                    <span key={i} className="gm-gloss">
                      {part.text}
                    </span>
                  ) : (
                    <span key={i}>{part.text}</span>
                  ),
                )}
              </p>
              <p className="gm-eyebrow gm-roomLabel">What you will see</p>
              <p className="gm-roomText">{game.sees}</p>
              <div className="gm-actions gm-roomActions">
                <Link className="gm-btnPrimary" href={game.href}>
                  Step inside
                </Link>
                <Link className="gm-btnGhost" href="/arcade">
                  Back to the floor
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </MotionPrefProvider>
  );
}
