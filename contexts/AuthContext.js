import * as fcl from "@onflow/fcl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useTransaction } from "./TransactionContext";

export const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const { initTransactionState, setTxId, setTransactionStatus } =
    useTransaction();
  const [currentUser, setUser] = useState({ loggedIn: false, addr: undefined });
  const [userProfile, setProfile] = useState(null);
  const [profileExists, setProfileExists] = useState(false);

  useEffect(() => fcl.currentUser.subscribe(setUser), []);

  const loadProfile = useCallback(async () => {
    const profile = await fcl.query({
      cadence: `
        import Profile from 0xProfile

        pub fun main(address: Address): Profile.ReadOnly? {
          return Profile.read(address)
        }
      `,
      args: (arg, t) => [arg(currentUser.addr, t.Address)],
    });
    setProfile(profile ?? null);
    setProfileExists(profile !== null);
    return profile;
  }, [currentUser, setProfile, setProfileExists]);

  useEffect(() => {
    // Upon login check if a userProfile exists
    if (currentUser.loggedIn && userProfile === null) {
      loadProfile();
    }
  }, [currentUser, userProfile, loadProfile]);

  const logOut = async () => {
    await fcl.unauthenticate();
    setUser({ addr: undefined, loggedIn: false });
    setProfile(null);
    setProfileExists(false);
  };

  const logIn = () => {
    fcl.logIn();
  };

  const signUp = () => {
    fcl.signUp();
  };

  const GetUserInfo =async () =>{
    if (!currentUser.addr) {
      return
    }
    // const formatedAddr = addr.substr(2)
    const response = await fcl.send([
      fcl.getAccount(currentUser.addr),
    ])
    alert(JSON.stringify(response));
  }

  const createProfile = async () => {
    initTransactionState();

    const transactionId = await fcl.mutate({
      cadence: `
        import Profile from 0xProfile

        transaction {
          prepare(account: AuthAccount) {
            // Only initialize the account if it hasn't already been initialized
            if (!Profile.check(account.address)) {
              // This creates and stores the profile in the user's account
              account.save(<- Profile.new(), to: Profile.privatePath)

              // This creates the public capability that lets applications read the profile's info
              account.link<&Profile.Base{Profile.Public}>(Profile.publicPath, target: Profile.privatePath)
            }
          }
        }
      `,
      payer: fcl.authz,
      proposer: fcl.authz,
      authorizations: [fcl.authz],
      limit: 50,
    });
    setTxId(transactionId);
    fcl.tx(transactionId).subscribe((res) => {
      setTransactionStatus(res.status);
      if (res.status === 4) {
        loadProfile();
      }
    });
  }; 
  
  const MintCryptoFoliage = async () => {
    initTransactionState();

    const transactionId = await fcl.mutate({
      cadence: `
      import CryptoFoliageV3 from 0xfa47be8b2835e2b5
      import FungibleToken from 0x9a0766d93b6608b7
      import FlowToken from 0x7e60df042a9c0868
      import NonFungibleToken from 0x631e88ae7f1d7c20
      
      // This transaction allows the Minter account to mint an NFT
      // and deposit it into its collection.
      
      transaction {
          prepare(acct: AuthAccount) {
              let vault = acct.borrow<&FungibleToken.Vault>(from: /storage/flowTokenVault)
                  ?? panic("could not borrow vault reference")
              let paid <- vault.withdraw(amount: CryptoFoliageV3.getPrice() * UFix64(3))
      
              let minted_collection <-CryptoFoliageV3.mintNFT(buyVault: <-paid, mintAmount: 3)
              let collection = acct.borrow<&CryptoFoliageV3.Collection>(from: CryptoFoliageV3.CollectionStoragePath)
              if (collection != nil) {
                  let nftIds = minted_collection.getIDs()
                  for nftId in nftIds {
                      collection!.deposit(token: <-minted_collection.withdraw(withdrawID: nftId))
                  }
                  destroy minted_collection
              } else {
                  acct.save<@NonFungibleToken.Collection>(<-minted_collection, to: CryptoFoliageV3.CollectionStoragePath)
              }
              log("nft minted for account")
          }
      
          execute {
      
          }
      }
      `,
      payer: fcl.authz,
      proposer: fcl.authz,
      authorizations: [fcl.authz],
      limit: 1000,
    });
    setTxId(transactionId);
    fcl.tx(transactionId).subscribe((res) => {
      setTransactionStatus(res.status);
      if (res.status === 4) {
        loadProfile();
      }
    });
  };

  const updateProfile = async ({ name, color, info }) => {
    console.log("Updating profile", { name, color, info });
    initTransactionState();

    const transactionId = await fcl.mutate({
      cadence: `
        import Profile from 0xProfile

        transaction(name: String, color: String, info: String) {
          prepare(account: AuthAccount) {
            account
              .borrow<&Profile.Base{Profile.Owner}>(from: Profile.privatePath)!
              .setName(name)

            account
              .borrow<&Profile.Base{Profile.Owner}>(from: Profile.privatePath)!
              .setInfo(info)

            account
              .borrow<&Profile.Base{Profile.Owner}>(from: Profile.privatePath)!
              .setColor(color)
          }
        }
      `,
      args: (arg, t) => [
        arg(name, t.String),
        arg(color, t.String),
        arg(info, t.String),
      ],
      payer: fcl.authz,
      proposer: fcl.authz,
      authorizations: [fcl.authz],
      limit: 50,
    });
    setTxId(transactionId);
    fcl.tx(transactionId).subscribe((res) => {
      setTransactionStatus(res.status);
      if (res.status === 4) {
        loadProfile();
      }
    });
  };

  const value = {
    currentUser,
    userProfile,
    profileExists,
    logOut,
    logIn,
    signUp,
    loadProfile,
    createProfile,
    updateProfile,
    MintCryptoFoliage,
    GetUserInfo,
  };

  //console.log("AuthProvider", value);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
