/* Generated from contracts/v1/withdrawals.schema.json. Do not edit. */

export interface PublicEvidenceWithdrawalsV1 {
  version: 1;
  objects: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[a-f0-9]{64}$".
     */
    [k: string]: {
      reason: string;
      withdrawn_at: string;
      /**
       * @minItems 1
       */
      release_ids: [string, ...string[]];
    };
  };
  editions: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^release-[a-f0-9]{64}$".
     */
    [k: string]: {
      reason: string;
      withdrawn_at: string;
      /**
       * @minItems 1
       */
      object_ids: [string, ...string[]];
    };
  };
}
