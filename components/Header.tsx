import Link from "next/link";
import SolscanSVG from "./SolscanSVG";
import TwitterSVG from "./TwitterSVG";

export default function Header() {
  return (
    <div className="absolute top-5 right-10">
      <div className="flex items-center justify-center gap-3">
        <Link
          rel="noreferrer nofollow"
          target={"_blank"}
          href={"https://twitter.com/BabyBonk_xyz"}
        >
          <button className="btn btn-ghost">
            <TwitterSVG />
          </button>
        </Link>
        <Link
          rel="noreferrer nofollow"
          target={"_blank"}
          href={"/baby-bonk-lite-paper.pdf"}
        >
          <button className="btn btn-ghost text-white">Lite Paper</button>
        </Link>
        <Link
          rel="noreferrer nofollow"
          target={"_blank"}
          href={`https://solscan.io/account/EUH9RrCQfQhu1Fq4X1Y6x8NSGsxeAbPynckM8M71M4ph`}
        >
          <button className="btn btn-ghost">
            <SolscanSVG />
          </button>
        </Link>
      </div>
    </div>
  );
}
