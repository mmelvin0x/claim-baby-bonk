import Head from "next/head";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import idl from "../idl.json";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Program } from "@coral-xyz/anchor";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Image from "next/image";
import Link from "next/link";
import Header from "../components/Header";
import * as qs from "qs";

const TOKEN_SALE_PROGRAM_ID = new PublicKey(idl.metadata.address);

const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet"),
  "processed"
);

export default function Home() {
  let mint: PublicKey;
  let authority: PublicKey;
  let numClaims: anchor.BN;
  let maxClaims: anchor.BN;
  let escrowTokenAccount: PublicKey;
  let takerTokenAccount: PublicKey;

  const wallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [claimedAddresses, setClaimedAddresses] = useState<string[]>([]);
  const [tokenSaleAccountState, setTokenSaleAccountState] = useState<any>({});

  async function swap() {
    if (wallet?.publicKey) {
      await getClaimedAddresses(wallet.publicKey.toString());
      if (claimedAddresses.includes(wallet.publicKey.toString())) {
        toast.error("You have already claimed your $BBONK!");
        return;
      }

      try {
        setLoading(true);
        const provider = new anchor.AnchorProvider(connection, wallet, {
          preflightCommitment: "processed",
        });
        const program = new Program(
          idl as anchor.Idl,
          TOKEN_SALE_PROGRAM_ID,
          provider
        );

        const programAccounts = await program.account.tokenSale.all();
        const tokenSaleAccount = programAccounts[0]?.account;
        const escrow = programAccounts[0]?.publicKey;

        if (!tokenSaleAccount) {
          setLoading(false);
          toast.info("The token claim period has ended!");
          return;
        }

        setTokenSaleAccountState({
          tokensRemaining: new anchor.BN(
            tokenSaleAccount.tokensRemaining as anchor.BN
          ),
          takerAmount: new anchor.BN(tokenSaleAccount.takerAmount as anchor.BN),
          numClaims: new anchor.BN(tokenSaleAccount.numClaims as anchor.BN),
        });

        numClaims = tokenSaleAccount.numClaims as anchor.BN;
        maxClaims = tokenSaleAccount.maxClaims as anchor.BN;
        if (numClaims.gte(maxClaims)) {
          setLoading(false);
          toast.info("The token claim period has ended!");
          return;
        }

        mint = tokenSaleAccount.mint as PublicKey;
        authority = tokenSaleAccount.authority as PublicKey;
        escrowTokenAccount = tokenSaleAccount.escrowTokenAccount as PublicKey;
        takerTokenAccount = await getAssociatedTokenAddress(
          mint,
          wallet.publicKey
        );

        const takerTokenAccountInfo = await connection.getParsedAccountInfo(
          takerTokenAccount
        );
        const takerHasTokens = new anchor.BN(
          // @ts-ignore
          takerTokenAccountInfo?.value?.data?.parsed.info.tokenAmount.amount ||
            0
        ).gt(new anchor.BN(0));

        if (!takerHasTokens) {
          const tx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              takerTokenAccount,
              wallet.publicKey,
              mint
            ),
            await program.methods
              .sellTokens()
              .accounts({
                taker: wallet.publicKey,
                initializer: authority,
                escrow,
                escrowTokenAccount,
                takerTokenAccount,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
              })
              .transaction()
          );

          tx.feePayer = wallet.publicKey;
          tx.recentBlockhash = (
            await connection.getLatestBlockhash()
          ).blockhash;

          toast.info("Approve the transaction to get your $BBONK...");
          const tx1 = await wallet.signTransaction(tx);
          const tx1Id = await connection.sendRawTransaction(tx1.serialize());
          await connection.confirmTransaction(tx1Id);

          toast.success("$BBONK received! LFG!");
          await getTokenSaleAccountState();
          setLoading(false);
          return;
        }

        const txSellTokens = await program.methods
          .sellTokens()
          .accounts({
            taker: wallet.publicKey,
            initializer: authority,
            escrow,
            escrowTokenAccount,
            takerTokenAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .transaction();

        txSellTokens.feePayer = wallet.publicKey;
        txSellTokens.recentBlockhash = (
          await connection.getLatestBlockhash()
        ).blockhash;

        toast.info("Approve the transaction to get your $BBONK...");

        const tx2 = await wallet.signTransaction(txSellTokens);
        const tx2Id = await connection.sendRawTransaction(tx2.serialize());
        await connection.confirmTransaction(tx2Id);

        await axios.post("/api/claim-list", {
          address: wallet.publicKey.toString(),
        });
        setClaimedAddresses((addresses: string[]) => [
          ...addresses,
          wallet.publicKey.toString(),
        ]);

        toast.success("$BBONK received! LFG!");

        setLoading(false);
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Something went wrong...");
        setLoading(false);
      }
    }
  }

  const getTokenSaleAccountState = async () => {
    if (wallet?.publicKey) {
      const provider = new anchor.AnchorProvider(connection, wallet, {
        preflightCommitment: "processed",
      });
      const program = new Program(
        idl as anchor.Idl,
        TOKEN_SALE_PROGRAM_ID,
        provider
      );

      const programAccounts = await program.account.tokenSale.all();
      const tokenSaleAccount = programAccounts[0]?.account;

      if (!tokenSaleAccount) {
        setLoading(false);
        toast.info("The token claim period has ended!");
        return;
      } else {
        setTokenSaleAccountState({
          tokensRemaining: new anchor.BN(
            tokenSaleAccount.tokensRemaining as anchor.BN
          ),
          takerAmount: new anchor.BN(tokenSaleAccount.takerAmount as anchor.BN),
          numClaims: new anchor.BN(tokenSaleAccount.numClaims as anchor.BN),
        });
      }
    }
  };

  const getClaimedAddresses = async (address: string) => {
    const { data } = await axios.get(`/api/claim-list?address=${address}`);
    setClaimedAddresses(data.addresses);
  };

  useEffect(() => {
    (async () => {
      if (wallet?.publicKey) {
        await getClaimedAddresses(wallet.publicKey.toString());
        await getTokenSaleAccountState();
      }
    })();
  }, [wallet?.publicKey]);

  return (
    <>
      <Head>
        <title>Baby Bonk</title>
        <meta name="description" content="The cutest coin on Solana" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />

        <div
          className="hero min-h-screen"
          style={{ backgroundImage: `url("/background.png")` }}
        >
          <Header />

          <div className="hero-content text-white">
            <div className="absolute left-1/4">
              <h1 className="mb-5 text-7xl font-extrabold">
                BABY BONK is here!
              </h1>
              <p className="mb-5 text-3xl font-bold">
                The cutest coin on Solana
              </p>
              {wallet?.publicKey ? (
                <div className="flex gap-3">
                  <label
                    htmlFor={"swap-modal"}
                    className="btn btn-primary btn-lg"
                  >
                    Get Baby Bonk
                  </label>
                  <WalletMultiButton className="btn btn-lg" />
                </div>
              ) : (
                <WalletMultiButton />
              )}
            </div>
          </div>

          <div className="absolute bottom-1">
            <p className="text-white font-bold flex items-center">
              <span>Powered by</span>
              <Image
                className="mx-2"
                src="/logo-full.png"
                height={35}
                width={125}
                alt="RightClickable"
              />
              <span>© 2022</span>
            </p>
          </div>
        </div>

        <input type="checkbox" id="swap-modal" className="modal-toggle" />
        <div className="modal">
          <div className="modal-box relative">
            {!loading && (
              <label
                htmlFor="swap-modal"
                className="btn btn-circle absolute right-2 top-2"
              >
                ✕
              </label>
            )}
            <h3 className="font-bold text-xl">
              Connect your wallet to Claim your $BBONK!
            </h3>
            <p className="py-4 text-lg">Get in early 😉</p>
            <p className="py-4 text-2xl">0.1 SOL = 69,420,420,420 $BBONK</p>
            <div className="py-4">
              <p className="text-sm">
                Tokens Remaining:{" "}
                {(
                  tokenSaleAccountState.tokensRemaining?.toString() / 10
                ).toLocaleString()}
              </p>
              <p className="text-sm">
                Number of Claims Made:{" "}
                {tokenSaleAccountState.numClaims?.toLocaleString()}
              </p>
            </div>

            <div className="modal-action">
              <Link href={"/baby-bonk-lite-paper.pdf"}>
                <button className="btn btn-outline">Lite Paper</button>
              </Link>
              {loading ? (
                <button className="btn loading" disabled={loading}>
                  Swap!
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={loading}
                  onClick={swap}
                >
                  Swap!
                </button>
              )}
            </div>

            <p className="py-2 text-right text-sm">
              You will need to approve 1-2 Transactions.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
