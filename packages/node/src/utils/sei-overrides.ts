// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { JsonRpcRequest, JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { Comet38Client as CosmosComet38Client } from '@cosmjs/tendermint-rpc/build/comet38';
import { Params as CometParams } from '@cosmjs/tendermint-rpc/build/comet38/adaptor/requests';
import { RpcClient } from '@cosmjs/tendermint-rpc/build/rpcclients';
import {
  BlockResponse,
  Event,
  BlockResultsResponse as TendermintBlockResultsResponse,
  Tendermint37Client as CosmosTendermint37Client,
} from '@cosmjs/tendermint-rpc/build/tendermint37';
import { Params } from '@cosmjs/tendermint-rpc/build/tendermint37/adaptor/requests';
import {
  Responses,
  decodeEvent,
} from '@cosmjs/tendermint-rpc/build/tendermint37/adaptor/responses';
import { assertArray } from '@cosmjs/tendermint-rpc/build/tendermint37/encodings';
import * as requests from '@cosmjs/tendermint-rpc/build/tendermint37/requests';
import * as responses from '@cosmjs/tendermint-rpc/build/tendermint37/responses';

export type BlockResultsResponse = TendermintBlockResultsResponse;
// & {
//   finalizeBlockEvents: readonly Event[];
// };

interface RpcBlockResultsResponse {
  readonly finalize_block_events: readonly RpcEvent[] | null;
}

export type Response =
  | responses.AbciInfoResponse
  | responses.AbciQueryResponse
  | BlockResponse
  | BlockResultsResponse
  | responses.BlockSearchResponse
  | responses.BlockchainResponse
  | responses.BroadcastTxAsyncResponse
  | responses.BroadcastTxSyncResponse
  | responses.BroadcastTxCommitResponse
  | responses.CommitResponse
  | responses.GenesisResponse
  | responses.HealthResponse
  | responses.NumUnconfirmedTxsResponse
  | responses.StatusResponse
  | responses.TxResponse
  | responses.TxSearchResponse
  | responses.ValidatorsResponse;

// Encoder is a generic that matches all methods of Params
type Encoder<T extends requests.Request> = (req: T) => JsonRpcRequest;

// Decoder is a generic that matches all methods of Responses
type Decoder<T extends Response> = (res: JsonRpcSuccessResponse) => T;

interface RpcEventAttribute {
  readonly key: string;
  readonly value?: string;
}

interface RpcEvent {
  readonly type: string;
  /** Can be omitted (see https://github.com/cosmos/cosmjs/pull/1198) */
  readonly attributes?: readonly RpcEventAttribute[];
}

function decodeEvents(events: readonly RpcEvent[]): readonly responses.Event[] {
  return assertArray(events).map(decodeEvent);
}

function decodeBlockResults(
  response: JsonRpcSuccessResponse,
): BlockResultsResponse {
  const r = Responses.decodeBlockResults(response);
  return {
    height: r.height,
    results: r.results,
    validatorUpdates: r.validatorUpdates,
    consensusUpdates: r.consensusUpdates,
    beginBlockEvents: r.beginBlockEvents,
    endBlockEvents: [
      ...r.endBlockEvents,
      ...decodeEvents(
        (response.result as RpcBlockResultsResponse).finalize_block_events ||
          [],
      ),
    ],
    // finalizeBlockEvents: decodeEvents(
    //   (response.result as RpcBlockResultsResponse).finalize_block_events || [],
    // ),
  };
}
export class Tendermint37Client {
  /**
   * Creates a new Tendermint client given an RPC client.
   */
  static async create(rpcClient: RpcClient): Promise<Tendermint37Client> {
    const tmClient = await CosmosTendermint37Client.create(rpcClient);
    return new Tendermint37Client(rpcClient, tmClient);
  }

  private readonly client: RpcClient;

  readonly tmClient: CosmosTendermint37Client;

  /**
   * Use `Tendermint37Client.connect` or `Tendermint37Client.create` to create an instance.
   */
  private constructor(client: RpcClient, tmClient: CosmosTendermint37Client) {
    this.client = client;
    this.tmClient = tmClient;
  }

  // doCall is a helper to handle the encode/call/decode logic
  private async doCall<T extends requests.Request, U extends Response>(
    request: T,
    encode: Encoder<T>,
    decode: Decoder<U>,
  ): Promise<U> {
    const req = encode(request);
    const result = await this.client.execute(req);
    return decode(result);
  }

  async validators(
    params: requests.ValidatorsParams,
  ): Promise<responses.ValidatorsResponse> {
    return this.tmClient.validators(params);
  }

  async block(height?: number): Promise<responses.BlockResponse> {
    const query: requests.BlockRequest = {
      method: requests.Method.Block,
      params: { height: height },
    };
    return this.doCall(query, Params.encodeBlock, Responses.decodeBlock);
  }

  async blockResults(height?: number): Promise<BlockResultsResponse> {
    const query: requests.BlockResultsRequest = {
      method: requests.Method.BlockResults,
      params: { height: height },
    };
    return this.doCall(query, Params.encodeBlockResults, decodeBlockResults);
  }

  disconnect(): void {
    this.tmClient.disconnect();
  }

  async status(): Promise<responses.StatusResponse> {
    return this.tmClient.status();
  }
}

export class Comet38Client {
  private readonly client: RpcClient;

  readonly tmClient: CosmosComet38Client;

  /**
   * Creates a new Tendermint client given an RPC client.
   */
  static async create(rpcClient: RpcClient): Promise<Comet38Client> {
    const tmClient = await CosmosComet38Client.create(rpcClient);
    return new Comet38Client(rpcClient, tmClient);
  }

  /**
   * Use `Tendermint37Client.connect` or `Tendermint37Client.create` to create an instance.
   */
  private constructor(client: RpcClient, tmClient: CosmosComet38Client) {
    this.client = client;
    this.tmClient = tmClient;
  }

  // doCall is a helper to handle the encode/call/decode logic
  private async doCall<T extends requests.Request, U extends Response>(
    request: T,
    encode: Encoder<T>,
    decode: Decoder<U>,
  ): Promise<U> {
    const req = encode(request);
    const result = await this.client.execute(req);
    return decode(result);
  }

  async validators(
    params: requests.ValidatorsParams,
  ): Promise<responses.ValidatorsResponse> {
    return this.tmClient.validators(params);
  }

  async block(height?: number): Promise<responses.BlockResponse> {
    const query: requests.BlockRequest = {
      method: requests.Method.Block,
      params: { height: height },
    };
    return this.doCall(query, CometParams.encodeBlock, Responses.decodeBlock);
  }

  async blockResults(height?: number): Promise<BlockResultsResponse> {
    const query: requests.BlockResultsRequest = {
      method: requests.Method.BlockResults,
      params: { height: height },
    };
    return this.doCall(
      query,
      CometParams.encodeBlockResults,
      decodeBlockResults,
    );
  }

  disconnect(): void {
    this.tmClient.disconnect();
  }
  async status(): Promise<responses.StatusResponse> {
    return this.tmClient.status();
  }
}

export type CometClient = Tendermint37Client | Comet38Client;
