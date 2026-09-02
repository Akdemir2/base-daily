import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const OWNER = "0xf6627465d9a5db57c0efde2abe46d906e46d5a31";
const SIGNER = "0x50DD6732B41d33A0E6442ea959A43467212740D8";

export default buildModule("BaseDailyModule", (m) => {
  const baseDaily = m.contract("BaseDaily", [OWNER, SIGNER]);

  return { baseDaily };
});
