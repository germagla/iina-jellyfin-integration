"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // packages/core/src/authorization.ts
  var DEFAULT_CLIENT_NAME = "Jellyfin for IINA";
  var DEFAULT_DEVICE_NAME = "IINA";
  function quoteAuthorizationValue(value) {
    if (/\r|\n/.test(value)) throw new TypeError("Authorization values cannot contain line breaks");
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  function createMediaBrowserAuthorization(options) {
    const fields = [
      ["Client", options.client],
      ["Device", options.device],
      ["DeviceId", options.deviceId],
      ["Version", options.version]
    ];
    if (options.accessToken !== void 0 && options.accessToken !== "") {
      fields.push(["Token", options.accessToken]);
    }
    return `MediaBrowser ${fields.map(([key, value]) => `${key}="${quoteAuthorizationValue(value)}"`).join(", ")}`;
  }
  function createAuthorizationHeaders(options) {
    return {
      Accept: "application/json",
      Authorization: createMediaBrowserAuthorization(options)
    };
  }

  // packages/core/src/device-profile.ts
  var VIDEO_CONTAINERS = "mkv,mp4,m4v,mov,ts,mpegts,webm,avi";
  var VIDEO_CODECS = "h264,hevc,vp8,vp9,av1,mpeg2video,mpeg4,vc1";
  var VIDEO_AUDIO_CODECS = "aac,ac3,eac3,mp3,flac,alac,opus,vorbis,pcm_s16le,pcm_s24le,truehd,dts";
  var AUDIO_CONTAINERS = "mp3,aac,m4a,flac,ogg,oga,opus,wav,aiff,alac";
  function createIinaDeviceProfile(maxStreamingBitrate = 12e7) {
    if (!Number.isInteger(maxStreamingBitrate) || maxStreamingBitrate < 1e6) {
      throw new RangeError("maxStreamingBitrate must be an integer of at least 1 Mbps");
    }
    return {
      Name: "IINA Direct Mode",
      MaxStreamingBitrate: maxStreamingBitrate,
      MaxStaticBitrate: maxStreamingBitrate,
      MusicStreamingTranscodingBitrate: 384e3,
      TimelineOffsetSeconds: 0,
      DirectPlayProfiles: [
        {
          Type: "Video",
          Container: VIDEO_CONTAINERS,
          VideoCodec: VIDEO_CODECS,
          AudioCodec: VIDEO_AUDIO_CODECS
        },
        {
          Type: "Audio",
          Container: AUDIO_CONTAINERS
        }
      ],
      TranscodingProfiles: [
        {
          Type: "Video",
          Context: "Streaming",
          Protocol: "hls",
          Container: "ts",
          VideoCodec: "h264,hevc",
          AudioCodec: "aac,ac3,eac3,opus",
          MaxAudioChannels: "8",
          CopyTimestamps: true,
          EnableSubtitlesInManifest: true
        },
        {
          Type: "Audio",
          Context: "Streaming",
          Protocol: "http",
          Container: "mp3",
          AudioCodec: "mp3",
          MaxAudioChannels: "2"
        }
      ],
      SubtitleProfiles: [
        { Format: "srt", Method: "External" },
        { Format: "vtt", Method: "External" },
        { Format: "ass", Method: "External" },
        { Format: "ssa", Method: "External" },
        { Format: "pgs", Method: "Embed" },
        { Format: "dvdsub", Method: "Embed" },
        { Format: "dvbsub", Method: "Embed" }
      ]
    };
  }

  // packages/core/src/url.ts
  var ServerUrlError = class extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.name = "ServerUrlError";
      this.code = code;
    }
  };
  function normalizedHostname(hostname) {
    return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
  }
  function isPrivateIpv4(hostname) {
    const pieces = hostname.split(".");
    if (pieces.length !== 4 || pieces.some((piece) => !/^\d{1,3}$/.test(piece))) return false;
    const octets = pieces.map(Number);
    if (octets.some((octet) => octet < 0 || octet > 255)) return false;
    const first = octets[0] ?? -1;
    const second = octets[1] ?? -1;
    return first === 10 || first === 127 || first === 169 && second === 254 || first === 172 && second >= 16 && second <= 31 || first === 192 && second === 168 || first === 100 && second >= 64 && second <= 127;
  }
  function isPrivateIpv6(hostname) {
    if (!hostname.includes(":")) return false;
    if (hostname === "::1" || hostname === "::") return true;
    const firstGroup = hostname.split(":")[0]?.toLowerCase() ?? "";
    if (/^f[cd][0-9a-f]{2}$/.test(firstGroup)) return true;
    if (/^fe[89ab][0-9a-f]$/.test(firstGroup)) return true;
    const mappedIpv4 = hostname.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
    return mappedIpv4 === void 0 ? false : isPrivateIpv4(mappedIpv4);
  }
  function isLocalHostname(hostname) {
    const host = normalizedHostname(hostname);
    return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || isPrivateIpv4(host) || isPrivateIpv6(host);
  }
  function parseUserSuppliedUrl(input) {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      throw new ServerUrlError("EMPTY_URL", "Enter a Jellyfin server URL");
    }
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      return new URL(withScheme);
    } catch {
      throw new ServerUrlError("INVALID_URL", "The Jellyfin server URL is not valid");
    }
  }
  function normalizeServerUrl(input, options = {}) {
    const parsed = parseUserSuppliedUrl(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ServerUrlError("UNSUPPORTED_PROTOCOL", "Jellyfin servers must use HTTP or HTTPS");
    }
    if (parsed.username !== "" || parsed.password !== "") {
      throw new ServerUrlError(
        "URL_CREDENTIALS_NOT_ALLOWED",
        "Do not put credentials in the server URL"
      );
    }
    if (parsed.search !== "" || parsed.hash !== "") {
      throw new ServerUrlError(
        "URL_QUERY_NOT_ALLOWED",
        "The server URL cannot contain a query or fragment"
      );
    }
    const local = isLocalHostname(parsed.hostname);
    if (parsed.protocol === "http:" && !local && options.allowInsecureRemote !== true) {
      throw new ServerUrlError(
        "INSECURE_REMOTE_SERVER",
        "Remote Jellyfin servers must use HTTPS unless insecure access is explicitly accepted"
      );
    }
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    const origin = parsed.origin;
    const url = `${origin}${path}`;
    const policy = parsed.protocol === "https:" ? "https" : local ? "local-http-warning" : "remote-http-accepted";
    return {
      url,
      origin,
      basePath: path,
      hostname: normalizedHostname(parsed.hostname),
      isLocal: local,
      policy
    };
  }
  function joinJellyfinPath(baseUrl, apiPath) {
    const normalized = normalizeServerUrl(baseUrl, { allowInsecureRemote: true });
    const suffix = apiPath.replace(/^\/+/, "");
    return suffix.length === 0 ? normalized.url : `${normalized.url}/${suffix}`;
  }
  function resolveJellyfinUrl(baseUrl, returnedUrl) {
    const value = returnedUrl.trim();
    const server = normalizeServerUrl(baseUrl, { allowInsecureRemote: true });
    let resolved;
    try {
      if (/^https?:\/\//i.test(value) || value.startsWith("//")) {
        resolved = new URL(value, server.origin);
      } else {
        resolved = new URL(value.replace(/^\/+/, ""), `${server.url}/`);
      }
    } catch {
      throw new ServerUrlError("INVALID_URL", "Jellyfin returned an invalid media URL");
    }
    const withinBasePath = server.basePath === "" || resolved.pathname === server.basePath || resolved.pathname.startsWith(`${server.basePath}/`);
    if (resolved.username !== "" || resolved.password !== "" || resolved.origin !== server.origin || !withinBasePath) {
      throw new ServerUrlError(
        "INVALID_URL",
        "Jellyfin returned a media URL outside the configured server address"
      );
    }
    return resolved.toString();
  }

  // packages/core/src/api.ts
  function authorizationOptions(identity, accessToken) {
    const result = {
      client: identity.client ?? DEFAULT_CLIENT_NAME,
      device: identity.device ?? DEFAULT_DEVICE_NAME,
      deviceId: identity.deviceId,
      version: identity.version
    };
    if (accessToken !== void 0) result.accessToken = accessToken;
    return result;
  }
  function jsonHeaders(identity, accessToken) {
    return {
      ...createAuthorizationHeaders(authorizationOptions(identity, accessToken)),
      "Content-Type": "application/json"
    };
  }
  function withQuery(url, values) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== void 0) search.set(key, String(value));
    }
    const query = search.toString();
    return query === "" ? url : `${url}?${query}`;
  }
  function itemFields() {
    return [
      "Overview",
      "Genres",
      "People",
      "DateCreated",
      "PremiereDate",
      "ProductionYear",
      "RunTimeTicks",
      "MediaSources",
      "MediaStreams",
      "ProviderIds",
      "CommunityRating"
    ].join(",");
  }
  function authenticatedHeaders(context) {
    return createAuthorizationHeaders(authorizationOptions(context, context.accessToken));
  }
  function buildPublicServerInfoRequest(serverUrl) {
    return {
      method: "GET",
      url: joinJellyfinPath(serverUrl, "System/Info/Public"),
      headers: { Accept: "application/json" }
    };
  }
  function buildPasswordAuthenticationRequest(serverUrl, identity, credentials) {
    return {
      method: "POST",
      url: joinJellyfinPath(serverUrl, "Users/AuthenticateByName"),
      headers: jsonHeaders(identity),
      body: { Username: credentials.username, Pw: credentials.password }
    };
  }
  function buildQuickConnectInitiateRequest(serverUrl, identity) {
    return {
      method: "POST",
      url: joinJellyfinPath(serverUrl, "QuickConnect/Initiate"),
      headers: jsonHeaders(identity),
      body: {}
    };
  }
  function buildQuickConnectStatusRequest(serverUrl, identity, secret) {
    return {
      method: "GET",
      url: withQuery(joinJellyfinPath(serverUrl, "QuickConnect/Connect"), { Secret: secret }),
      headers: createAuthorizationHeaders(authorizationOptions(identity))
    };
  }
  function buildQuickConnectAuthenticationRequest(serverUrl, identity, secret) {
    return {
      method: "POST",
      url: joinJellyfinPath(serverUrl, "Users/AuthenticateWithQuickConnect"),
      headers: jsonHeaders(identity),
      body: { Secret: secret }
    };
  }
  function buildCatalogRequest(rawRequest, context) {
    const request = rawRequest;
    const userId = encodeURIComponent(context.userId);
    const headers = authenticatedHeaders(context);
    const fields = itemFields();
    switch (request.kind) {
      case "libraries":
        return {
          method: "GET",
          url: joinJellyfinPath(context.serverUrl, `Users/${userId}/Views`),
          headers
        };
      case "home": {
        if (request.shelf === "continueWatching") {
          return {
            method: "GET",
            url: withQuery(joinJellyfinPath(context.serverUrl, `Users/${userId}/Items/Resume`), {
              IncludeItemTypes: "Movie,Episode",
              Fields: fields,
              ImageTypeLimit: 1,
              EnableImageTypes: "Primary,Backdrop,Thumb",
              Limit: request.limit
            }),
            headers
          };
        }
        if (request.shelf === "nextUp") {
          return {
            method: "GET",
            url: withQuery(joinJellyfinPath(context.serverUrl, "Shows/NextUp"), {
              UserId: context.userId,
              Fields: fields,
              ImageTypeLimit: 1,
              EnableImageTypes: "Primary,Backdrop,Thumb",
              Limit: request.limit,
              SeriesId: request.seriesId
            }),
            headers
          };
        }
        return {
          method: "GET",
          url: withQuery(joinJellyfinPath(context.serverUrl, `Users/${userId}/Items/Latest`), {
            IncludeItemTypes: "Movie,Series,Episode",
            Fields: fields,
            ImageTypeLimit: 1,
            EnableImageTypes: "Primary,Backdrop,Thumb",
            Limit: request.limit
          }),
          headers
        };
      }
      case "library":
        return {
          method: "GET",
          url: withQuery(joinJellyfinPath(context.serverUrl, `Users/${userId}/Items`), {
            ParentId: request.parentId,
            IncludeItemTypes: request.itemType,
            Recursive: true,
            Fields: fields,
            ImageTypeLimit: 1,
            EnableImageTypes: "Primary,Backdrop,Thumb",
            StartIndex: request.startIndex,
            Limit: request.limit,
            SortBy: request.sortBy,
            SortOrder: request.sortOrder,
            EnableTotalRecordCount: true
          }),
          headers
        };
      case "search":
        return {
          method: "GET",
          url: withQuery(joinJellyfinPath(context.serverUrl, `Users/${userId}/Items`), {
            SearchTerm: request.query,
            IncludeItemTypes: request.includeItemTypes.join(","),
            Recursive: true,
            Fields: fields,
            ImageTypeLimit: 1,
            EnableImageTypes: "Primary,Backdrop,Thumb",
            StartIndex: request.startIndex,
            Limit: request.limit,
            EnableTotalRecordCount: true
          }),
          headers
        };
      case "details":
        return {
          method: "GET",
          url: withQuery(
            joinJellyfinPath(
              context.serverUrl,
              `Users/${userId}/Items/${encodeURIComponent(request.itemId)}`
            ),
            { Fields: fields }
          ),
          headers
        };
      case "episodes":
        return {
          method: "GET",
          url: withQuery(
            joinJellyfinPath(
              context.serverUrl,
              `Shows/${encodeURIComponent(request.seriesId)}/Episodes`
            ),
            {
              UserId: context.userId,
              SeasonId: request.seasonId,
              Fields: fields,
              StartIndex: request.startIndex,
              Limit: request.limit,
              EnableTotalRecordCount: true
            }
          ),
          headers
        };
    }
  }
  function buildArtworkHttpRequest(rawRequest, context) {
    const request = rawRequest;
    return {
      method: "GET",
      url: withQuery(
        joinJellyfinPath(
          context.serverUrl,
          `Items/${encodeURIComponent(request.itemId)}/Images/${request.imageType}`
        ),
        {
          tag: request.imageTag,
          maxWidth: request.width,
          maxHeight: request.height,
          quality: request.quality
        }
      ),
      headers: authenticatedHeaders(context)
    };
  }
  function buildPlaybackInfoRequest(request, context) {
    const body = {
      UserId: context.userId,
      StartTimeTicks: request.startPositionTicks,
      MaxStreamingBitrate: request.maxStreamingBitrate,
      EnableDirectPlay: true,
      EnableDirectStream: true,
      EnableTranscoding: true,
      AllowVideoStreamCopy: true,
      AllowAudioStreamCopy: true,
      AutoOpenLiveStream: false,
      DeviceProfile: createIinaDeviceProfile(request.maxStreamingBitrate)
    };
    if (request.mediaSourceId !== void 0) body.MediaSourceId = request.mediaSourceId;
    if (request.audioStreamIndex !== void 0) body.AudioStreamIndex = request.audioStreamIndex;
    if (request.subtitleStreamIndex !== void 0)
      body.SubtitleStreamIndex = request.subtitleStreamIndex;
    return {
      method: "POST",
      url: withQuery(
        joinJellyfinPath(
          context.serverUrl,
          `Items/${encodeURIComponent(request.itemId)}/PlaybackInfo`
        ),
        {
          UserId: context.userId
        }
      ),
      headers: jsonHeaders(context, context.accessToken),
      body
    };
  }

  // node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
  var external_exports = {};
  __export(external_exports, {
    BRAND: () => BRAND,
    DIRTY: () => DIRTY,
    EMPTY_PATH: () => EMPTY_PATH,
    INVALID: () => INVALID,
    NEVER: () => NEVER,
    OK: () => OK,
    ParseStatus: () => ParseStatus,
    Schema: () => ZodType,
    ZodAny: () => ZodAny,
    ZodArray: () => ZodArray,
    ZodBigInt: () => ZodBigInt,
    ZodBoolean: () => ZodBoolean,
    ZodBranded: () => ZodBranded,
    ZodCatch: () => ZodCatch,
    ZodDate: () => ZodDate,
    ZodDefault: () => ZodDefault,
    ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
    ZodEffects: () => ZodEffects,
    ZodEnum: () => ZodEnum,
    ZodError: () => ZodError,
    ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
    ZodFunction: () => ZodFunction,
    ZodIntersection: () => ZodIntersection,
    ZodIssueCode: () => ZodIssueCode,
    ZodLazy: () => ZodLazy,
    ZodLiteral: () => ZodLiteral,
    ZodMap: () => ZodMap,
    ZodNaN: () => ZodNaN,
    ZodNativeEnum: () => ZodNativeEnum,
    ZodNever: () => ZodNever,
    ZodNull: () => ZodNull,
    ZodNullable: () => ZodNullable,
    ZodNumber: () => ZodNumber,
    ZodObject: () => ZodObject,
    ZodOptional: () => ZodOptional,
    ZodParsedType: () => ZodParsedType,
    ZodPipeline: () => ZodPipeline,
    ZodPromise: () => ZodPromise,
    ZodReadonly: () => ZodReadonly,
    ZodRecord: () => ZodRecord,
    ZodSchema: () => ZodType,
    ZodSet: () => ZodSet,
    ZodString: () => ZodString,
    ZodSymbol: () => ZodSymbol,
    ZodTransformer: () => ZodEffects,
    ZodTuple: () => ZodTuple,
    ZodType: () => ZodType,
    ZodUndefined: () => ZodUndefined,
    ZodUnion: () => ZodUnion,
    ZodUnknown: () => ZodUnknown,
    ZodVoid: () => ZodVoid,
    addIssueToContext: () => addIssueToContext,
    any: () => anyType,
    array: () => arrayType,
    bigint: () => bigIntType,
    boolean: () => booleanType,
    coerce: () => coerce,
    custom: () => custom,
    date: () => dateType,
    datetimeRegex: () => datetimeRegex,
    defaultErrorMap: () => en_default,
    discriminatedUnion: () => discriminatedUnionType,
    effect: () => effectsType,
    enum: () => enumType,
    function: () => functionType,
    getErrorMap: () => getErrorMap,
    getParsedType: () => getParsedType,
    instanceof: () => instanceOfType,
    intersection: () => intersectionType,
    isAborted: () => isAborted,
    isAsync: () => isAsync,
    isDirty: () => isDirty,
    isValid: () => isValid,
    late: () => late,
    lazy: () => lazyType,
    literal: () => literalType,
    makeIssue: () => makeIssue,
    map: () => mapType,
    nan: () => nanType,
    nativeEnum: () => nativeEnumType,
    never: () => neverType,
    null: () => nullType,
    nullable: () => nullableType,
    number: () => numberType,
    object: () => objectType,
    objectUtil: () => objectUtil,
    oboolean: () => oboolean,
    onumber: () => onumber,
    optional: () => optionalType,
    ostring: () => ostring,
    pipeline: () => pipelineType,
    preprocess: () => preprocessType,
    promise: () => promiseType,
    quotelessJson: () => quotelessJson,
    record: () => recordType,
    set: () => setType,
    setErrorMap: () => setErrorMap,
    strictObject: () => strictObjectType,
    string: () => stringType,
    symbol: () => symbolType,
    transformer: () => effectsType,
    tuple: () => tupleType,
    undefined: () => undefinedType,
    union: () => unionType,
    unknown: () => unknownType,
    util: () => util,
    void: () => voidType
  });

  // node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
  var util;
  (function(util2) {
    util2.assertEqual = (_) => {
    };
    function assertIs(_arg) {
    }
    util2.assertIs = assertIs;
    function assertNever(_x) {
      throw new Error();
    }
    util2.assertNever = assertNever;
    util2.arrayToEnum = (items) => {
      const obj = {};
      for (const item of items) {
        obj[item] = item;
      }
      return obj;
    };
    util2.getValidEnumValues = (obj) => {
      const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
      const filtered = {};
      for (const k of validKeys) {
        filtered[k] = obj[k];
      }
      return util2.objectValues(filtered);
    };
    util2.objectValues = (obj) => {
      return util2.objectKeys(obj).map(function(e) {
        return obj[e];
      });
    };
    util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
      const keys = [];
      for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          keys.push(key);
        }
      }
      return keys;
    };
    util2.find = (arr, checker) => {
      for (const item of arr) {
        if (checker(item))
          return item;
      }
      return void 0;
    };
    util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
      return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
    }
    util2.joinValues = joinValues;
    util2.jsonStringifyReplacer = (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    };
  })(util || (util = {}));
  var objectUtil;
  (function(objectUtil2) {
    objectUtil2.mergeShapes = (first, second) => {
      return {
        ...first,
        ...second
        // second overwrites first
      };
    };
  })(objectUtil || (objectUtil = {}));
  var ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
  var getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
      case "undefined":
        return ZodParsedType.undefined;
      case "string":
        return ZodParsedType.string;
      case "number":
        return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
      case "boolean":
        return ZodParsedType.boolean;
      case "function":
        return ZodParsedType.function;
      case "bigint":
        return ZodParsedType.bigint;
      case "symbol":
        return ZodParsedType.symbol;
      case "object":
        if (Array.isArray(data)) {
          return ZodParsedType.array;
        }
        if (data === null) {
          return ZodParsedType.null;
        }
        if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
          return ZodParsedType.promise;
        }
        if (typeof Map !== "undefined" && data instanceof Map) {
          return ZodParsedType.map;
        }
        if (typeof Set !== "undefined" && data instanceof Set) {
          return ZodParsedType.set;
        }
        if (typeof Date !== "undefined" && data instanceof Date) {
          return ZodParsedType.date;
        }
        return ZodParsedType.object;
      default:
        return ZodParsedType.unknown;
    }
  };

  // node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
  var ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite"
  ]);
  var quotelessJson = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/"([^"]+)":/g, "$1:");
  };
  var ZodError = class _ZodError extends Error {
    get errors() {
      return this.issues;
    }
    constructor(issues) {
      super();
      this.issues = [];
      this.addIssue = (sub) => {
        this.issues = [...this.issues, sub];
      };
      this.addIssues = (subs = []) => {
        this.issues = [...this.issues, ...subs];
      };
      const actualProto = new.target.prototype;
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(this, actualProto);
      } else {
        this.__proto__ = actualProto;
      }
      this.name = "ZodError";
      this.issues = issues;
    }
    format(_mapper) {
      const mapper = _mapper || function(issue) {
        return issue.message;
      };
      const fieldErrors = { _errors: [] };
      const processError = (error) => {
        for (const issue of error.issues) {
          if (issue.code === "invalid_union") {
            issue.unionErrors.map(processError);
          } else if (issue.code === "invalid_return_type") {
            processError(issue.returnTypeError);
          } else if (issue.code === "invalid_arguments") {
            processError(issue.argumentsError);
          } else if (issue.path.length === 0) {
            fieldErrors._errors.push(mapper(issue));
          } else {
            let curr = fieldErrors;
            let i = 0;
            while (i < issue.path.length) {
              const el = issue.path[i];
              const terminal = i === issue.path.length - 1;
              if (!terminal) {
                curr[el] = curr[el] || { _errors: [] };
              } else {
                curr[el] = curr[el] || { _errors: [] };
                curr[el]._errors.push(mapper(issue));
              }
              curr = curr[el];
              i++;
            }
          }
        }
      };
      processError(this);
      return fieldErrors;
    }
    static assert(value) {
      if (!(value instanceof _ZodError)) {
        throw new Error(`Not a ZodError: ${value}`);
      }
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
      const fieldErrors = {};
      const formErrors = [];
      for (const sub of this.issues) {
        if (sub.path.length > 0) {
          const firstEl = sub.path[0];
          fieldErrors[firstEl] = fieldErrors[firstEl] || [];
          fieldErrors[firstEl].push(mapper(sub));
        } else {
          formErrors.push(mapper(sub));
        }
      }
      return { formErrors, fieldErrors };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
  };

  // node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
  var errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
      case ZodIssueCode.invalid_type:
        if (issue.received === ZodParsedType.undefined) {
          message = "Required";
        } else {
          message = `Expected ${issue.expected}, received ${issue.received}`;
        }
        break;
      case ZodIssueCode.invalid_literal:
        message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
        break;
      case ZodIssueCode.unrecognized_keys:
        message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
        break;
      case ZodIssueCode.invalid_union:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_union_discriminator:
        message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
        break;
      case ZodIssueCode.invalid_enum_value:
        message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
        break;
      case ZodIssueCode.invalid_arguments:
        message = `Invalid function arguments`;
        break;
      case ZodIssueCode.invalid_return_type:
        message = `Invalid function return type`;
        break;
      case ZodIssueCode.invalid_date:
        message = `Invalid date`;
        break;
      case ZodIssueCode.invalid_string:
        if (typeof issue.validation === "object") {
          if ("includes" in issue.validation) {
            message = `Invalid input: must include "${issue.validation.includes}"`;
            if (typeof issue.validation.position === "number") {
              message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
            }
          } else if ("startsWith" in issue.validation) {
            message = `Invalid input: must start with "${issue.validation.startsWith}"`;
          } else if ("endsWith" in issue.validation) {
            message = `Invalid input: must end with "${issue.validation.endsWith}"`;
          } else {
            util.assertNever(issue.validation);
          }
        } else if (issue.validation !== "regex") {
          message = `Invalid ${issue.validation}`;
        } else {
          message = "Invalid";
        }
        break;
      case ZodIssueCode.too_small:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
        else if (issue.type === "bigint")
          message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.too_big:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "bigint")
          message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.custom:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_intersection_types:
        message = `Intersection results could not be merged`;
        break;
      case ZodIssueCode.not_multiple_of:
        message = `Number must be a multiple of ${issue.multipleOf}`;
        break;
      case ZodIssueCode.not_finite:
        message = "Number must be finite";
        break;
      default:
        message = _ctx.defaultError;
        util.assertNever(issue);
    }
    return { message };
  };
  var en_default = errorMap;

  // node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
  var overrideErrorMap = en_default;
  function setErrorMap(map) {
    overrideErrorMap = map;
  }
  function getErrorMap() {
    return overrideErrorMap;
  }

  // node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
  var makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...issueData.path || []];
    const fullIssue = {
      ...issueData,
      path: fullPath
    };
    if (issueData.message !== void 0) {
      return {
        ...issueData,
        path: fullPath,
        message: issueData.message
      };
    }
    let errorMessage = "";
    const maps = errorMaps.filter((m) => !!m).slice().reverse();
    for (const map of maps) {
      errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
      ...issueData,
      path: fullPath,
      message: errorMessage
    };
  };
  var EMPTY_PATH = [];
  function addIssueToContext(ctx, issueData) {
    const overrideMap = getErrorMap();
    const issue = makeIssue({
      issueData,
      data: ctx.data,
      path: ctx.path,
      errorMaps: [
        ctx.common.contextualErrorMap,
        // contextual error map is first priority
        ctx.schemaErrorMap,
        // then schema-bound map if available
        overrideMap,
        // then global override map
        overrideMap === en_default ? void 0 : en_default
        // then global default map
      ].filter((x) => !!x)
    });
    ctx.common.issues.push(issue);
  }
  var ParseStatus = class _ParseStatus {
    constructor() {
      this.value = "valid";
    }
    dirty() {
      if (this.value === "valid")
        this.value = "dirty";
    }
    abort() {
      if (this.value !== "aborted")
        this.value = "aborted";
    }
    static mergeArray(status, results) {
      const arrayValue = [];
      for (const s of results) {
        if (s.status === "aborted")
          return INVALID;
        if (s.status === "dirty")
          status.dirty();
        arrayValue.push(s.value);
      }
      return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
      const syncPairs = [];
      for (const pair of pairs) {
        const key = await pair.key;
        const value = await pair.value;
        syncPairs.push({
          key,
          value
        });
      }
      return _ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
      const finalObject = {};
      for (const pair of pairs) {
        const { key, value } = pair;
        if (key.status === "aborted")
          return INVALID;
        if (value.status === "aborted")
          return INVALID;
        if (key.status === "dirty")
          status.dirty();
        if (value.status === "dirty")
          status.dirty();
        if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
          finalObject[key.value] = value.value;
        }
      }
      return { status: status.value, value: finalObject };
    }
  };
  var INVALID = Object.freeze({
    status: "aborted"
  });
  var DIRTY = (value) => ({ status: "dirty", value });
  var OK = (value) => ({ status: "valid", value });
  var isAborted = (x) => x.status === "aborted";
  var isDirty = (x) => x.status === "dirty";
  var isValid = (x) => x.status === "valid";
  var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

  // node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
  var errorUtil;
  (function(errorUtil2) {
    errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
  })(errorUtil || (errorUtil = {}));

  // node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
  var ParseInputLazyPath = class {
    constructor(parent, value, path, key) {
      this._cachedPath = [];
      this.parent = parent;
      this.data = value;
      this._path = path;
      this._key = key;
    }
    get path() {
      if (!this._cachedPath.length) {
        if (Array.isArray(this._key)) {
          this._cachedPath.push(...this._path, ...this._key);
        } else {
          this._cachedPath.push(...this._path, this._key);
        }
      }
      return this._cachedPath;
    }
  };
  var handleResult = (ctx, result) => {
    if (isValid(result)) {
      return { success: true, data: result.value };
    } else {
      if (!ctx.common.issues.length) {
        throw new Error("Validation failed but no issues detected.");
      }
      return {
        success: false,
        get error() {
          if (this._error)
            return this._error;
          const error = new ZodError(ctx.common.issues);
          this._error = error;
          return this._error;
        }
      };
    }
  };
  function processCreateParams(params) {
    if (!params)
      return {};
    const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
    if (errorMap2 && (invalid_type_error || required_error)) {
      throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap2)
      return { errorMap: errorMap2, description };
    const customMap = (iss, ctx) => {
      const { message } = params;
      if (iss.code === "invalid_enum_value") {
        return { message: message ?? ctx.defaultError };
      }
      if (typeof ctx.data === "undefined") {
        return { message: message ?? required_error ?? ctx.defaultError };
      }
      if (iss.code !== "invalid_type")
        return { message: ctx.defaultError };
      return { message: message ?? invalid_type_error ?? ctx.defaultError };
    };
    return { errorMap: customMap, description };
  }
  var ZodType = class {
    get description() {
      return this._def.description;
    }
    _getType(input) {
      return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
      return ctx || {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      };
    }
    _processInputParams(input) {
      return {
        status: new ParseStatus(),
        ctx: {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        }
      };
    }
    _parseSync(input) {
      const result = this._parse(input);
      if (isAsync(result)) {
        throw new Error("Synchronous parse encountered promise.");
      }
      return result;
    }
    _parseAsync(input) {
      const result = this._parse(input);
      return Promise.resolve(result);
    }
    parse(data, params) {
      const result = this.safeParse(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    safeParse(data, params) {
      const ctx = {
        common: {
          issues: [],
          async: params?.async ?? false,
          contextualErrorMap: params?.errorMap
        },
        path: params?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const result = this._parseSync({ data, path: ctx.path, parent: ctx });
      return handleResult(ctx, result);
    }
    "~validate"(data) {
      const ctx = {
        common: {
          issues: [],
          async: !!this["~standard"].async
        },
        path: [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      if (!this["~standard"].async) {
        try {
          const result = this._parseSync({ data, path: [], parent: ctx });
          return isValid(result) ? {
            value: result.value
          } : {
            issues: ctx.common.issues
          };
        } catch (err) {
          if (err?.message?.toLowerCase()?.includes("encountered")) {
            this["~standard"].async = true;
          }
          ctx.common = {
            issues: [],
            async: true
          };
        }
      }
      return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
        value: result.value
      } : {
        issues: ctx.common.issues
      });
    }
    async parseAsync(data, params) {
      const result = await this.safeParseAsync(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    async safeParseAsync(data, params) {
      const ctx = {
        common: {
          issues: [],
          contextualErrorMap: params?.errorMap,
          async: true
        },
        path: params?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
      const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
      return handleResult(ctx, result);
    }
    refine(check, message) {
      const getIssueProperties = (val) => {
        if (typeof message === "string" || typeof message === "undefined") {
          return { message };
        } else if (typeof message === "function") {
          return message(val);
        } else {
          return message;
        }
      };
      return this._refinement((val, ctx) => {
        const result = check(val);
        const setError = () => ctx.addIssue({
          code: ZodIssueCode.custom,
          ...getIssueProperties(val)
        });
        if (typeof Promise !== "undefined" && result instanceof Promise) {
          return result.then((data) => {
            if (!data) {
              setError();
              return false;
            } else {
              return true;
            }
          });
        }
        if (!result) {
          setError();
          return false;
        } else {
          return true;
        }
      });
    }
    refinement(check, refinementData) {
      return this._refinement((val, ctx) => {
        if (!check(val)) {
          ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
          return false;
        } else {
          return true;
        }
      });
    }
    _refinement(refinement) {
      return new ZodEffects({
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "refinement", refinement }
      });
    }
    superRefine(refinement) {
      return this._refinement(refinement);
    }
    constructor(def) {
      this.spa = this.safeParseAsync;
      this._def = def;
      this.parse = this.parse.bind(this);
      this.safeParse = this.safeParse.bind(this);
      this.parseAsync = this.parseAsync.bind(this);
      this.safeParseAsync = this.safeParseAsync.bind(this);
      this.spa = this.spa.bind(this);
      this.refine = this.refine.bind(this);
      this.refinement = this.refinement.bind(this);
      this.superRefine = this.superRefine.bind(this);
      this.optional = this.optional.bind(this);
      this.nullable = this.nullable.bind(this);
      this.nullish = this.nullish.bind(this);
      this.array = this.array.bind(this);
      this.promise = this.promise.bind(this);
      this.or = this.or.bind(this);
      this.and = this.and.bind(this);
      this.transform = this.transform.bind(this);
      this.brand = this.brand.bind(this);
      this.default = this.default.bind(this);
      this.catch = this.catch.bind(this);
      this.describe = this.describe.bind(this);
      this.pipe = this.pipe.bind(this);
      this.readonly = this.readonly.bind(this);
      this.isNullable = this.isNullable.bind(this);
      this.isOptional = this.isOptional.bind(this);
      this["~standard"] = {
        version: 1,
        vendor: "zod",
        validate: (data) => this["~validate"](data)
      };
    }
    optional() {
      return ZodOptional.create(this, this._def);
    }
    nullable() {
      return ZodNullable.create(this, this._def);
    }
    nullish() {
      return this.nullable().optional();
    }
    array() {
      return ZodArray.create(this);
    }
    promise() {
      return ZodPromise.create(this, this._def);
    }
    or(option) {
      return ZodUnion.create([this, option], this._def);
    }
    and(incoming) {
      return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
      return new ZodEffects({
        ...processCreateParams(this._def),
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "transform", transform }
      });
    }
    default(def) {
      const defaultValueFunc = typeof def === "function" ? def : () => def;
      return new ZodDefault({
        ...processCreateParams(this._def),
        innerType: this,
        defaultValue: defaultValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodDefault
      });
    }
    brand() {
      return new ZodBranded({
        typeName: ZodFirstPartyTypeKind.ZodBranded,
        type: this,
        ...processCreateParams(this._def)
      });
    }
    catch(def) {
      const catchValueFunc = typeof def === "function" ? def : () => def;
      return new ZodCatch({
        ...processCreateParams(this._def),
        innerType: this,
        catchValue: catchValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodCatch
      });
    }
    describe(description) {
      const This = this.constructor;
      return new This({
        ...this._def,
        description
      });
    }
    pipe(target) {
      return ZodPipeline.create(this, target);
    }
    readonly() {
      return ZodReadonly.create(this);
    }
    isOptional() {
      return this.safeParse(void 0).success;
    }
    isNullable() {
      return this.safeParse(null).success;
    }
  };
  var cuidRegex = /^c[^\s-]{8,}$/i;
  var cuid2Regex = /^[0-9a-z]+$/;
  var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
  var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
  var nanoidRegex = /^[a-z0-9_-]{21}$/i;
  var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
  var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
  var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
  var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
  var emojiRegex;
  var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
  var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
  var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
  var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
  var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
  var dateRegex = new RegExp(`^${dateRegexSource}$`);
  function timeRegexSource(args) {
    let secondsRegexSource = `[0-5]\\d`;
    if (args.precision) {
      secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
    } else if (args.precision == null) {
      secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
    }
    const secondsQuantifier = args.precision ? "+" : "?";
    return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
  }
  function timeRegex(args) {
    return new RegExp(`^${timeRegexSource(args)}$`);
  }
  function datetimeRegex(args) {
    let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
      opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
  }
  function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
      return true;
    }
    return false;
  }
  function isValidJWT(jwt, alg) {
    if (!jwtRegex.test(jwt))
      return false;
    try {
      const [header] = jwt.split(".");
      if (!header)
        return false;
      const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
      const decoded = JSON.parse(atob(base64));
      if (typeof decoded !== "object" || decoded === null)
        return false;
      if ("typ" in decoded && decoded?.typ !== "JWT")
        return false;
      if (!decoded.alg)
        return false;
      if (alg && decoded.alg !== alg)
        return false;
      return true;
    } catch {
      return false;
    }
  }
  function isValidCidr(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
      return true;
    }
    return false;
  }
  var ZodString = class _ZodString extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = String(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.string) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.string,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.length < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.length > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "length") {
          const tooBig = input.data.length > check.value;
          const tooSmall = input.data.length < check.value;
          if (tooBig || tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            if (tooBig) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            } else if (tooSmall) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            }
            status.dirty();
          }
        } else if (check.kind === "email") {
          if (!emailRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "email",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "emoji") {
          if (!emojiRegex) {
            emojiRegex = new RegExp(_emojiRegex, "u");
          }
          if (!emojiRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "emoji",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "uuid") {
          if (!uuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "uuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "nanoid") {
          if (!nanoidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "nanoid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid") {
          if (!cuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid2") {
          if (!cuid2Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid2",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ulid") {
          if (!ulidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ulid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "url") {
          try {
            new URL(input.data);
          } catch {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "regex") {
          check.regex.lastIndex = 0;
          const testResult = check.regex.test(input.data);
          if (!testResult) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "regex",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "trim") {
          input.data = input.data.trim();
        } else if (check.kind === "includes") {
          if (!input.data.includes(check.value, check.position)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { includes: check.value, position: check.position },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "toLowerCase") {
          input.data = input.data.toLowerCase();
        } else if (check.kind === "toUpperCase") {
          input.data = input.data.toUpperCase();
        } else if (check.kind === "startsWith") {
          if (!input.data.startsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { startsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "endsWith") {
          if (!input.data.endsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { endsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "datetime") {
          const regex = datetimeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "datetime",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "date") {
          const regex = dateRegex;
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "date",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "time") {
          const regex = timeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "time",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "duration") {
          if (!durationRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "duration",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ip") {
          if (!isValidIP(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ip",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "jwt") {
          if (!isValidJWT(input.data, check.alg)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "jwt",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cidr") {
          if (!isValidCidr(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cidr",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64") {
          if (!base64Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64url") {
          if (!base64urlRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
      return this.refinement((data) => regex.test(data), {
        validation,
        code: ZodIssueCode.invalid_string,
        ...errorUtil.errToObj(message)
      });
    }
    _addCheck(check) {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    email(message) {
      return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
      return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    emoji(message) {
      return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
      return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    nanoid(message) {
      return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
      return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    cuid2(message) {
      return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
    }
    ulid(message) {
      return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
    }
    base64(message) {
      return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
    }
    base64url(message) {
      return this._addCheck({
        kind: "base64url",
        ...errorUtil.errToObj(message)
      });
    }
    jwt(options) {
      return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
    }
    ip(options) {
      return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
    }
    cidr(options) {
      return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
    }
    datetime(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "datetime",
          precision: null,
          offset: false,
          local: false,
          message: options
        });
      }
      return this._addCheck({
        kind: "datetime",
        precision: typeof options?.precision === "undefined" ? null : options?.precision,
        offset: options?.offset ?? false,
        local: options?.local ?? false,
        ...errorUtil.errToObj(options?.message)
      });
    }
    date(message) {
      return this._addCheck({ kind: "date", message });
    }
    time(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "time",
          precision: null,
          message: options
        });
      }
      return this._addCheck({
        kind: "time",
        precision: typeof options?.precision === "undefined" ? null : options?.precision,
        ...errorUtil.errToObj(options?.message)
      });
    }
    duration(message) {
      return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
    }
    regex(regex, message) {
      return this._addCheck({
        kind: "regex",
        regex,
        ...errorUtil.errToObj(message)
      });
    }
    includes(value, options) {
      return this._addCheck({
        kind: "includes",
        value,
        position: options?.position,
        ...errorUtil.errToObj(options?.message)
      });
    }
    startsWith(value, message) {
      return this._addCheck({
        kind: "startsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    endsWith(value, message) {
      return this._addCheck({
        kind: "endsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    min(minLength, message) {
      return this._addCheck({
        kind: "min",
        value: minLength,
        ...errorUtil.errToObj(message)
      });
    }
    max(maxLength, message) {
      return this._addCheck({
        kind: "max",
        value: maxLength,
        ...errorUtil.errToObj(message)
      });
    }
    length(len, message) {
      return this._addCheck({
        kind: "length",
        value: len,
        ...errorUtil.errToObj(message)
      });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(message) {
      return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "trim" }]
      });
    }
    toLowerCase() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toLowerCase" }]
      });
    }
    toUpperCase() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toUpperCase" }]
      });
    }
    get isDatetime() {
      return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
      return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
      return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
      return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
      return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
      return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
      return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
      return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
      return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
      return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
      return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
      return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
      return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxLength() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodString.create = (params) => {
    return new ZodString({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodString,
      coerce: params?.coerce ?? false,
      ...processCreateParams(params)
    });
  };
  function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return valInt % stepInt / 10 ** decCount;
  }
  var ZodNumber = class _ZodNumber extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
      this.step = this.multipleOf;
    }
    _parse(input) {
      if (this._def.coerce) {
        input.data = Number(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.number) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.number,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "int") {
          if (!util.isInteger(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: "integer",
              received: "float",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (floatSafeRemainder(input.data, check.value) !== 0) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "finite") {
          if (!Number.isFinite(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_finite,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodNumber({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new _ZodNumber({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    int(message) {
      return this._addCheck({
        kind: "int",
        message: errorUtil.toString(message)
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    finite(message) {
      return this._addCheck({
        kind: "finite",
        message: errorUtil.toString(message)
      });
    }
    safe(message) {
      return this._addCheck({
        kind: "min",
        inclusive: true,
        value: Number.MIN_SAFE_INTEGER,
        message: errorUtil.toString(message)
      })._addCheck({
        kind: "max",
        inclusive: true,
        value: Number.MAX_SAFE_INTEGER,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
    get isInt() {
      return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
    }
    get isFinite() {
      let max = null;
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
          return true;
        } else if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        } else if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return Number.isFinite(min) && Number.isFinite(max);
    }
  };
  ZodNumber.create = (params) => {
    return new ZodNumber({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodNumber,
      coerce: params?.coerce || false,
      ...processCreateParams(params)
    });
  };
  var ZodBigInt = class _ZodBigInt extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
    }
    _parse(input) {
      if (this._def.coerce) {
        try {
          input.data = BigInt(input.data);
        } catch {
          return this._getInvalidInput(input);
        }
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.bigint) {
        return this._getInvalidInput(input);
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              type: "bigint",
              minimum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              type: "bigint",
              maximum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (input.data % check.value !== BigInt(0)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx.parsedType
      });
      return INVALID;
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodBigInt({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new _ZodBigInt({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodBigInt.create = (params) => {
    return new ZodBigInt({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodBigInt,
      coerce: params?.coerce ?? false,
      ...processCreateParams(params)
    });
  };
  var ZodBoolean = class extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = Boolean(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.boolean) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.boolean,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodBoolean.create = (params) => {
    return new ZodBoolean({
      typeName: ZodFirstPartyTypeKind.ZodBoolean,
      coerce: params?.coerce || false,
      ...processCreateParams(params)
    });
  };
  var ZodDate = class _ZodDate extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = new Date(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.date) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.date,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      if (Number.isNaN(input.data.getTime())) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_date
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.getTime() < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              message: check.message,
              inclusive: true,
              exact: false,
              minimum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.getTime() > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              message: check.message,
              inclusive: true,
              exact: false,
              maximum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return {
        status: status.value,
        value: new Date(input.data.getTime())
      };
    }
    _addCheck(check) {
      return new _ZodDate({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    min(minDate, message) {
      return this._addCheck({
        kind: "min",
        value: minDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    max(maxDate, message) {
      return this._addCheck({
        kind: "max",
        value: maxDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    get minDate() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min != null ? new Date(min) : null;
    }
    get maxDate() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max != null ? new Date(max) : null;
    }
  };
  ZodDate.create = (params) => {
    return new ZodDate({
      checks: [],
      coerce: params?.coerce || false,
      typeName: ZodFirstPartyTypeKind.ZodDate,
      ...processCreateParams(params)
    });
  };
  var ZodSymbol = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.symbol) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.symbol,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodSymbol.create = (params) => {
    return new ZodSymbol({
      typeName: ZodFirstPartyTypeKind.ZodSymbol,
      ...processCreateParams(params)
    });
  };
  var ZodUndefined = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.undefined,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodUndefined.create = (params) => {
    return new ZodUndefined({
      typeName: ZodFirstPartyTypeKind.ZodUndefined,
      ...processCreateParams(params)
    });
  };
  var ZodNull = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.null) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.null,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodNull.create = (params) => {
    return new ZodNull({
      typeName: ZodFirstPartyTypeKind.ZodNull,
      ...processCreateParams(params)
    });
  };
  var ZodAny = class extends ZodType {
    constructor() {
      super(...arguments);
      this._any = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodAny.create = (params) => {
    return new ZodAny({
      typeName: ZodFirstPartyTypeKind.ZodAny,
      ...processCreateParams(params)
    });
  };
  var ZodUnknown = class extends ZodType {
    constructor() {
      super(...arguments);
      this._unknown = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodUnknown.create = (params) => {
    return new ZodUnknown({
      typeName: ZodFirstPartyTypeKind.ZodUnknown,
      ...processCreateParams(params)
    });
  };
  var ZodNever = class extends ZodType {
    _parse(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.never,
        received: ctx.parsedType
      });
      return INVALID;
    }
  };
  ZodNever.create = (params) => {
    return new ZodNever({
      typeName: ZodFirstPartyTypeKind.ZodNever,
      ...processCreateParams(params)
    });
  };
  var ZodVoid = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.void,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodVoid.create = (params) => {
    return new ZodVoid({
      typeName: ZodFirstPartyTypeKind.ZodVoid,
      ...processCreateParams(params)
    });
  };
  var ZodArray = class _ZodArray extends ZodType {
    _parse(input) {
      const { ctx, status } = this._processInputParams(input);
      const def = this._def;
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (def.exactLength !== null) {
        const tooBig = ctx.data.length > def.exactLength.value;
        const tooSmall = ctx.data.length < def.exactLength.value;
        if (tooBig || tooSmall) {
          addIssueToContext(ctx, {
            code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
            minimum: tooSmall ? def.exactLength.value : void 0,
            maximum: tooBig ? def.exactLength.value : void 0,
            type: "array",
            inclusive: true,
            exact: true,
            message: def.exactLength.message
          });
          status.dirty();
        }
      }
      if (def.minLength !== null) {
        if (ctx.data.length < def.minLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.minLength.message
          });
          status.dirty();
        }
      }
      if (def.maxLength !== null) {
        if (ctx.data.length > def.maxLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.maxLength.message
          });
          status.dirty();
        }
      }
      if (ctx.common.async) {
        return Promise.all([...ctx.data].map((item, i) => {
          return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        })).then((result2) => {
          return ParseStatus.mergeArray(status, result2);
        });
      }
      const result = [...ctx.data].map((item, i) => {
        return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      });
      return ParseStatus.mergeArray(status, result);
    }
    get element() {
      return this._def.type;
    }
    min(minLength, message) {
      return new _ZodArray({
        ...this._def,
        minLength: { value: minLength, message: errorUtil.toString(message) }
      });
    }
    max(maxLength, message) {
      return new _ZodArray({
        ...this._def,
        maxLength: { value: maxLength, message: errorUtil.toString(message) }
      });
    }
    length(len, message) {
      return new _ZodArray({
        ...this._def,
        exactLength: { value: len, message: errorUtil.toString(message) }
      });
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodArray.create = (schema, params) => {
    return new ZodArray({
      type: schema,
      minLength: null,
      maxLength: null,
      exactLength: null,
      typeName: ZodFirstPartyTypeKind.ZodArray,
      ...processCreateParams(params)
    });
  };
  function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
      const newShape = {};
      for (const key in schema.shape) {
        const fieldSchema = schema.shape[key];
        newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
      }
      return new ZodObject({
        ...schema._def,
        shape: () => newShape
      });
    } else if (schema instanceof ZodArray) {
      return new ZodArray({
        ...schema._def,
        type: deepPartialify(schema.element)
      });
    } else if (schema instanceof ZodOptional) {
      return ZodOptional.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodNullable) {
      return ZodNullable.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodTuple) {
      return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    } else {
      return schema;
    }
  }
  var ZodObject = class _ZodObject extends ZodType {
    constructor() {
      super(...arguments);
      this._cached = null;
      this.nonstrict = this.passthrough;
      this.augment = this.extend;
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      const shape = this._def.shape();
      const keys = util.objectKeys(shape);
      this._cached = { shape, keys };
      return this._cached;
    }
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.object) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const { status, ctx } = this._processInputParams(input);
      const { shape, keys: shapeKeys } = this._getCached();
      const extraKeys = [];
      if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
        for (const key in ctx.data) {
          if (!shapeKeys.includes(key)) {
            extraKeys.push(key);
          }
        }
      }
      const pairs = [];
      for (const key of shapeKeys) {
        const keyValidator = shape[key];
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (this._def.catchall instanceof ZodNever) {
        const unknownKeys = this._def.unknownKeys;
        if (unknownKeys === "passthrough") {
          for (const key of extraKeys) {
            pairs.push({
              key: { status: "valid", value: key },
              value: { status: "valid", value: ctx.data[key] }
            });
          }
        } else if (unknownKeys === "strict") {
          if (extraKeys.length > 0) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.unrecognized_keys,
              keys: extraKeys
            });
            status.dirty();
          }
        } else if (unknownKeys === "strip") {
        } else {
          throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
        }
      } else {
        const catchall = this._def.catchall;
        for (const key of extraKeys) {
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: catchall._parse(
              new ParseInputLazyPath(ctx, value, ctx.path, key)
              //, ctx.child(key), value, getParsedType(value)
            ),
            alwaysSet: key in ctx.data
          });
        }
      }
      if (ctx.common.async) {
        return Promise.resolve().then(async () => {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
              key,
              value,
              alwaysSet: pair.alwaysSet
            });
          }
          return syncPairs;
        }).then((syncPairs) => {
          return ParseStatus.mergeObjectSync(status, syncPairs);
        });
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get shape() {
      return this._def.shape();
    }
    strict(message) {
      errorUtil.errToObj;
      return new _ZodObject({
        ...this._def,
        unknownKeys: "strict",
        ...message !== void 0 ? {
          errorMap: (issue, ctx) => {
            const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
            if (issue.code === "unrecognized_keys")
              return {
                message: errorUtil.errToObj(message).message ?? defaultError
              };
            return {
              message: defaultError
            };
          }
        } : {}
      });
    }
    strip() {
      return new _ZodObject({
        ...this._def,
        unknownKeys: "strip"
      });
    }
    passthrough() {
      return new _ZodObject({
        ...this._def,
        unknownKeys: "passthrough"
      });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
      return new _ZodObject({
        ...this._def,
        shape: () => ({
          ...this._def.shape(),
          ...augmentation
        })
      });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
      const merged = new _ZodObject({
        unknownKeys: merging._def.unknownKeys,
        catchall: merging._def.catchall,
        shape: () => ({
          ...this._def.shape(),
          ...merging._def.shape()
        }),
        typeName: ZodFirstPartyTypeKind.ZodObject
      });
      return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
      return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
      return new _ZodObject({
        ...this._def,
        catchall: index
      });
    }
    pick(mask) {
      const shape = {};
      for (const key of util.objectKeys(mask)) {
        if (mask[key] && this.shape[key]) {
          shape[key] = this.shape[key];
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    omit(mask) {
      const shape = {};
      for (const key of util.objectKeys(this.shape)) {
        if (!mask[key]) {
          shape[key] = this.shape[key];
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    /**
     * @deprecated
     */
    deepPartial() {
      return deepPartialify(this);
    }
    partial(mask) {
      const newShape = {};
      for (const key of util.objectKeys(this.shape)) {
        const fieldSchema = this.shape[key];
        if (mask && !mask[key]) {
          newShape[key] = fieldSchema;
        } else {
          newShape[key] = fieldSchema.optional();
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    required(mask) {
      const newShape = {};
      for (const key of util.objectKeys(this.shape)) {
        if (mask && !mask[key]) {
          newShape[key] = this.shape[key];
        } else {
          const fieldSchema = this.shape[key];
          let newField = fieldSchema;
          while (newField instanceof ZodOptional) {
            newField = newField._def.innerType;
          }
          newShape[key] = newField;
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    keyof() {
      return createZodEnum(util.objectKeys(this.shape));
    }
  };
  ZodObject.create = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.strictCreate = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strict",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.lazycreate = (shape, params) => {
    return new ZodObject({
      shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  var ZodUnion = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const options = this._def.options;
      function handleResults(results) {
        for (const result of results) {
          if (result.result.status === "valid") {
            return result.result;
          }
        }
        for (const result of results) {
          if (result.result.status === "dirty") {
            ctx.common.issues.push(...result.ctx.common.issues);
            return result.result;
          }
        }
        const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return Promise.all(options.map(async (option) => {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          return {
            result: await option._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            }),
            ctx: childCtx
          };
        })).then(handleResults);
      } else {
        let dirty = void 0;
        const issues = [];
        for (const option of options) {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          const result = option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          });
          if (result.status === "valid") {
            return result;
          } else if (result.status === "dirty" && !dirty) {
            dirty = { result, ctx: childCtx };
          }
          if (childCtx.common.issues.length) {
            issues.push(childCtx.common.issues);
          }
        }
        if (dirty) {
          ctx.common.issues.push(...dirty.ctx.common.issues);
          return dirty.result;
        }
        const unionErrors = issues.map((issues2) => new ZodError(issues2));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
    }
    get options() {
      return this._def.options;
    }
  };
  ZodUnion.create = (types, params) => {
    return new ZodUnion({
      options: types,
      typeName: ZodFirstPartyTypeKind.ZodUnion,
      ...processCreateParams(params)
    });
  };
  var getDiscriminator = (type) => {
    if (type instanceof ZodLazy) {
      return getDiscriminator(type.schema);
    } else if (type instanceof ZodEffects) {
      return getDiscriminator(type.innerType());
    } else if (type instanceof ZodLiteral) {
      return [type.value];
    } else if (type instanceof ZodEnum) {
      return type.options;
    } else if (type instanceof ZodNativeEnum) {
      return util.objectValues(type.enum);
    } else if (type instanceof ZodDefault) {
      return getDiscriminator(type._def.innerType);
    } else if (type instanceof ZodUndefined) {
      return [void 0];
    } else if (type instanceof ZodNull) {
      return [null];
    } else if (type instanceof ZodOptional) {
      return [void 0, ...getDiscriminator(type.unwrap())];
    } else if (type instanceof ZodNullable) {
      return [null, ...getDiscriminator(type.unwrap())];
    } else if (type instanceof ZodBranded) {
      return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodReadonly) {
      return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodCatch) {
      return getDiscriminator(type._def.innerType);
    } else {
      return [];
    }
  };
  var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const discriminator = this.discriminator;
      const discriminatorValue = ctx.data[discriminator];
      const option = this.optionsMap.get(discriminatorValue);
      if (!option) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union_discriminator,
          options: Array.from(this.optionsMap.keys()),
          path: [discriminator]
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return option._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      } else {
        return option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      }
    }
    get discriminator() {
      return this._def.discriminator;
    }
    get options() {
      return this._def.options;
    }
    get optionsMap() {
      return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
      const optionsMap = /* @__PURE__ */ new Map();
      for (const type of options) {
        const discriminatorValues = getDiscriminator(type.shape[discriminator]);
        if (!discriminatorValues.length) {
          throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
        }
        for (const value of discriminatorValues) {
          if (optionsMap.has(value)) {
            throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
          }
          optionsMap.set(value, type);
        }
      }
      return new _ZodDiscriminatedUnion({
        typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
        discriminator,
        options,
        optionsMap,
        ...processCreateParams(params)
      });
    }
  };
  function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
      return { valid: true, data: a };
    } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
      const bKeys = util.objectKeys(b);
      const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
      const newObj = { ...a, ...b };
      for (const key of sharedKeys) {
        const sharedValue = mergeValues(a[key], b[key]);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newObj[key] = sharedValue.data;
      }
      return { valid: true, data: newObj };
    } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
      if (a.length !== b.length) {
        return { valid: false };
      }
      const newArray = [];
      for (let index = 0; index < a.length; index++) {
        const itemA = a[index];
        const itemB = b[index];
        const sharedValue = mergeValues(itemA, itemB);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newArray.push(sharedValue.data);
      }
      return { valid: true, data: newArray };
    } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
      return { valid: true, data: a };
    } else {
      return { valid: false };
    }
  }
  var ZodIntersection = class extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const handleParsed = (parsedLeft, parsedRight) => {
        if (isAborted(parsedLeft) || isAborted(parsedRight)) {
          return INVALID;
        }
        const merged = mergeValues(parsedLeft.value, parsedRight.value);
        if (!merged.valid) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_intersection_types
          });
          return INVALID;
        }
        if (isDirty(parsedLeft) || isDirty(parsedRight)) {
          status.dirty();
        }
        return { status: status.value, value: merged.data };
      };
      if (ctx.common.async) {
        return Promise.all([
          this._def.left._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }),
          this._def.right._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          })
        ]).then(([left, right]) => handleParsed(left, right));
      } else {
        return handleParsed(this._def.left._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }), this._def.right._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }));
      }
    }
  };
  ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection({
      left,
      right,
      typeName: ZodFirstPartyTypeKind.ZodIntersection,
      ...processCreateParams(params)
    });
  };
  var ZodTuple = class _ZodTuple extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (ctx.data.length < this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        return INVALID;
      }
      const rest = this._def.rest;
      if (!rest && ctx.data.length > this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        status.dirty();
      }
      const items = [...ctx.data].map((item, itemIndex) => {
        const schema = this._def.items[itemIndex] || this._def.rest;
        if (!schema)
          return null;
        return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
      }).filter((x) => !!x);
      if (ctx.common.async) {
        return Promise.all(items).then((results) => {
          return ParseStatus.mergeArray(status, results);
        });
      } else {
        return ParseStatus.mergeArray(status, items);
      }
    }
    get items() {
      return this._def.items;
    }
    rest(rest) {
      return new _ZodTuple({
        ...this._def,
        rest
      });
    }
  };
  ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
      items: schemas,
      typeName: ZodFirstPartyTypeKind.ZodTuple,
      rest: null,
      ...processCreateParams(params)
    });
  };
  var ZodRecord = class _ZodRecord extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const pairs = [];
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      for (const key in ctx.data) {
        pairs.push({
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
          value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (ctx.common.async) {
        return ParseStatus.mergeObjectAsync(status, pairs);
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get element() {
      return this._def.valueType;
    }
    static create(first, second, third) {
      if (second instanceof ZodType) {
        return new _ZodRecord({
          keyType: first,
          valueType: second,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(third)
        });
      }
      return new _ZodRecord({
        keyType: ZodString.create(),
        valueType: first,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(second)
      });
    }
  };
  var ZodMap = class extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.map) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.map,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      const pairs = [...ctx.data.entries()].map(([key, value], index) => {
        return {
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
          value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
        };
      });
      if (ctx.common.async) {
        const finalMap = /* @__PURE__ */ new Map();
        return Promise.resolve().then(async () => {
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        });
      } else {
        const finalMap = /* @__PURE__ */ new Map();
        for (const pair of pairs) {
          const key = pair.key;
          const value = pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      }
    }
  };
  ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap({
      valueType,
      keyType,
      typeName: ZodFirstPartyTypeKind.ZodMap,
      ...processCreateParams(params)
    });
  };
  var ZodSet = class _ZodSet extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.set) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.set,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const def = this._def;
      if (def.minSize !== null) {
        if (ctx.data.size < def.minSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.minSize.message
          });
          status.dirty();
        }
      }
      if (def.maxSize !== null) {
        if (ctx.data.size > def.maxSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.maxSize.message
          });
          status.dirty();
        }
      }
      const valueType = this._def.valueType;
      function finalizeSet(elements2) {
        const parsedSet = /* @__PURE__ */ new Set();
        for (const element of elements2) {
          if (element.status === "aborted")
            return INVALID;
          if (element.status === "dirty")
            status.dirty();
          parsedSet.add(element.value);
        }
        return { status: status.value, value: parsedSet };
      }
      const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
      if (ctx.common.async) {
        return Promise.all(elements).then((elements2) => finalizeSet(elements2));
      } else {
        return finalizeSet(elements);
      }
    }
    min(minSize, message) {
      return new _ZodSet({
        ...this._def,
        minSize: { value: minSize, message: errorUtil.toString(message) }
      });
    }
    max(maxSize, message) {
      return new _ZodSet({
        ...this._def,
        maxSize: { value: maxSize, message: errorUtil.toString(message) }
      });
    }
    size(size, message) {
      return this.min(size, message).max(size, message);
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodSet.create = (valueType, params) => {
    return new ZodSet({
      valueType,
      minSize: null,
      maxSize: null,
      typeName: ZodFirstPartyTypeKind.ZodSet,
      ...processCreateParams(params)
    });
  };
  var ZodFunction = class _ZodFunction extends ZodType {
    constructor() {
      super(...arguments);
      this.validate = this.implement;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.function) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.function,
          received: ctx.parsedType
        });
        return INVALID;
      }
      function makeArgsIssue(args, error) {
        return makeIssue({
          data: args,
          path: ctx.path,
          errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
          issueData: {
            code: ZodIssueCode.invalid_arguments,
            argumentsError: error
          }
        });
      }
      function makeReturnsIssue(returns, error) {
        return makeIssue({
          data: returns,
          path: ctx.path,
          errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
          issueData: {
            code: ZodIssueCode.invalid_return_type,
            returnTypeError: error
          }
        });
      }
      const params = { errorMap: ctx.common.contextualErrorMap };
      const fn = ctx.data;
      if (this._def.returns instanceof ZodPromise) {
        const me = this;
        return OK(async function(...args) {
          const error = new ZodError([]);
          const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
            error.addIssue(makeArgsIssue(args, e));
            throw error;
          });
          const result = await Reflect.apply(fn, this, parsedArgs);
          const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
            error.addIssue(makeReturnsIssue(result, e));
            throw error;
          });
          return parsedReturns;
        });
      } else {
        const me = this;
        return OK(function(...args) {
          const parsedArgs = me._def.args.safeParse(args, params);
          if (!parsedArgs.success) {
            throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
          }
          const result = Reflect.apply(fn, this, parsedArgs.data);
          const parsedReturns = me._def.returns.safeParse(result, params);
          if (!parsedReturns.success) {
            throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
          }
          return parsedReturns.data;
        });
      }
    }
    parameters() {
      return this._def.args;
    }
    returnType() {
      return this._def.returns;
    }
    args(...items) {
      return new _ZodFunction({
        ...this._def,
        args: ZodTuple.create(items).rest(ZodUnknown.create())
      });
    }
    returns(returnType) {
      return new _ZodFunction({
        ...this._def,
        returns: returnType
      });
    }
    implement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    strictImplement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    static create(args, returns, params) {
      return new _ZodFunction({
        args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
        returns: returns || ZodUnknown.create(),
        typeName: ZodFirstPartyTypeKind.ZodFunction,
        ...processCreateParams(params)
      });
    }
  };
  var ZodLazy = class extends ZodType {
    get schema() {
      return this._def.getter();
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const lazySchema = this._def.getter();
      return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
  };
  ZodLazy.create = (getter, params) => {
    return new ZodLazy({
      getter,
      typeName: ZodFirstPartyTypeKind.ZodLazy,
      ...processCreateParams(params)
    });
  };
  var ZodLiteral = class extends ZodType {
    _parse(input) {
      if (input.data !== this._def.value) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_literal,
          expected: this._def.value
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
    get value() {
      return this._def.value;
    }
  };
  ZodLiteral.create = (value, params) => {
    return new ZodLiteral({
      value,
      typeName: ZodFirstPartyTypeKind.ZodLiteral,
      ...processCreateParams(params)
    });
  };
  function createZodEnum(values, params) {
    return new ZodEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodEnum,
      ...processCreateParams(params)
    });
  }
  var ZodEnum = class _ZodEnum extends ZodType {
    _parse(input) {
      if (typeof input.data !== "string") {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!this._cache) {
        this._cache = new Set(this._def.values);
      }
      if (!this._cache.has(input.data)) {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Values() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    extract(values, newDef = this._def) {
      return _ZodEnum.create(values, {
        ...this._def,
        ...newDef
      });
    }
    exclude(values, newDef = this._def) {
      return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
        ...this._def,
        ...newDef
      });
    }
  };
  ZodEnum.create = createZodEnum;
  var ZodNativeEnum = class extends ZodType {
    _parse(input) {
      const nativeEnumValues = util.getValidEnumValues(this._def.values);
      const ctx = this._getOrReturnCtx(input);
      if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!this._cache) {
        this._cache = new Set(util.getValidEnumValues(this._def.values));
      }
      if (!this._cache.has(input.data)) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
      ...processCreateParams(params)
    });
  };
  var ZodPromise = class extends ZodType {
    unwrap() {
      return this._def.type;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.promise,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
      return OK(promisified.then((data) => {
        return this._def.type.parseAsync(data, {
          path: ctx.path,
          errorMap: ctx.common.contextualErrorMap
        });
      }));
    }
  };
  ZodPromise.create = (schema, params) => {
    return new ZodPromise({
      type: schema,
      typeName: ZodFirstPartyTypeKind.ZodPromise,
      ...processCreateParams(params)
    });
  };
  var ZodEffects = class extends ZodType {
    innerType() {
      return this._def.schema;
    }
    sourceType() {
      return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const effect = this._def.effect || null;
      const checkCtx = {
        addIssue: (arg) => {
          addIssueToContext(ctx, arg);
          if (arg.fatal) {
            status.abort();
          } else {
            status.dirty();
          }
        },
        get path() {
          return ctx.path;
        }
      };
      checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
      if (effect.type === "preprocess") {
        const processed = effect.transform(ctx.data, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(processed).then(async (processed2) => {
            if (status.value === "aborted")
              return INVALID;
            const result = await this._def.schema._parseAsync({
              data: processed2,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          });
        } else {
          if (status.value === "aborted")
            return INVALID;
          const result = this._def.schema._parseSync({
            data: processed,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        }
      }
      if (effect.type === "refinement") {
        const executeRefinement = (acc) => {
          const result = effect.refinement(acc, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(result);
          }
          if (result instanceof Promise) {
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          }
          return acc;
        };
        if (ctx.common.async === false) {
          const inner = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          executeRefinement(inner.value);
          return { status: status.value, value: inner.value };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            return executeRefinement(inner.value).then(() => {
              return { status: status.value, value: inner.value };
            });
          });
        }
      }
      if (effect.type === "transform") {
        if (ctx.common.async === false) {
          const base = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (!isValid(base))
            return INVALID;
          const result = effect.transform(base.value, checkCtx);
          if (result instanceof Promise) {
            throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
          }
          return { status: status.value, value: result };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
            if (!isValid(base))
              return INVALID;
            return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
              status: status.value,
              value: result
            }));
          });
        }
      }
      util.assertNever(effect);
    }
  };
  ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects({
      schema,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect,
      ...processCreateParams(params)
    });
  };
  ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects({
      schema,
      effect: { type: "preprocess", transform: preprocess },
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      ...processCreateParams(params)
    });
  };
  var ZodOptional = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.undefined) {
        return OK(void 0);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodOptional.create = (type, params) => {
    return new ZodOptional({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodOptional,
      ...processCreateParams(params)
    });
  };
  var ZodNullable = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.null) {
        return OK(null);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodNullable.create = (type, params) => {
    return new ZodNullable({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodNullable,
      ...processCreateParams(params)
    });
  };
  var ZodDefault = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      let data = ctx.data;
      if (ctx.parsedType === ZodParsedType.undefined) {
        data = this._def.defaultValue();
      }
      return this._def.innerType._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  ZodDefault.create = (type, params) => {
    return new ZodDefault({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodDefault,
      defaultValue: typeof params.default === "function" ? params.default : () => params.default,
      ...processCreateParams(params)
    });
  };
  var ZodCatch = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const newCtx = {
        ...ctx,
        common: {
          ...ctx.common,
          issues: []
        }
      };
      const result = this._def.innerType._parse({
        data: newCtx.data,
        path: newCtx.path,
        parent: {
          ...newCtx
        }
      });
      if (isAsync(result)) {
        return result.then((result2) => {
          return {
            status: "valid",
            value: result2.status === "valid" ? result2.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        });
      } else {
        return {
          status: "valid",
          value: result.status === "valid" ? result.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      }
    }
    removeCatch() {
      return this._def.innerType;
    }
  };
  ZodCatch.create = (type, params) => {
    return new ZodCatch({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodCatch,
      catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
      ...processCreateParams(params)
    });
  };
  var ZodNaN = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.nan) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.nan,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
  };
  ZodNaN.create = (params) => {
    return new ZodNaN({
      typeName: ZodFirstPartyTypeKind.ZodNaN,
      ...processCreateParams(params)
    });
  };
  var BRAND = /* @__PURE__ */ Symbol("zod_brand");
  var ZodBranded = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const data = ctx.data;
      return this._def.type._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    unwrap() {
      return this._def.type;
    }
  };
  var ZodPipeline = class _ZodPipeline extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.common.async) {
        const handleAsync = async () => {
          const inResult = await this._def.in._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return DIRTY(inResult.value);
          } else {
            return this._def.out._parseAsync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        };
        return handleAsync();
      } else {
        const inResult = this._def.in._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return {
            status: "dirty",
            value: inResult.value
          };
        } else {
          return this._def.out._parseSync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }
    }
    static create(a, b) {
      return new _ZodPipeline({
        in: a,
        out: b,
        typeName: ZodFirstPartyTypeKind.ZodPipeline
      });
    }
  };
  var ZodReadonly = class extends ZodType {
    _parse(input) {
      const result = this._def.innerType._parse(input);
      const freeze = (data) => {
        if (isValid(data)) {
          data.value = Object.freeze(data.value);
        }
        return data;
      };
      return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodReadonly.create = (type, params) => {
    return new ZodReadonly({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodReadonly,
      ...processCreateParams(params)
    });
  };
  function cleanParams(params, data) {
    const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
    const p2 = typeof p === "string" ? { message: p } : p;
    return p2;
  }
  function custom(check, _params = {}, fatal) {
    if (check)
      return ZodAny.create().superRefine((data, ctx) => {
        const r = check(data);
        if (r instanceof Promise) {
          return r.then((r2) => {
            if (!r2) {
              const params = cleanParams(_params, data);
              const _fatal = params.fatal ?? fatal ?? true;
              ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
            }
          });
        }
        if (!r) {
          const params = cleanParams(_params, data);
          const _fatal = params.fatal ?? fatal ?? true;
          ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
        }
        return;
      });
    return ZodAny.create();
  }
  var late = {
    object: ZodObject.lazycreate
  };
  var ZodFirstPartyTypeKind;
  (function(ZodFirstPartyTypeKind2) {
    ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
  })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
  var instanceOfType = (cls, params = {
    message: `Input not instance of ${cls.name}`
  }) => custom((data) => data instanceof cls, params);
  var stringType = ZodString.create;
  var numberType = ZodNumber.create;
  var nanType = ZodNaN.create;
  var bigIntType = ZodBigInt.create;
  var booleanType = ZodBoolean.create;
  var dateType = ZodDate.create;
  var symbolType = ZodSymbol.create;
  var undefinedType = ZodUndefined.create;
  var nullType = ZodNull.create;
  var anyType = ZodAny.create;
  var unknownType = ZodUnknown.create;
  var neverType = ZodNever.create;
  var voidType = ZodVoid.create;
  var arrayType = ZodArray.create;
  var objectType = ZodObject.create;
  var strictObjectType = ZodObject.strictCreate;
  var unionType = ZodUnion.create;
  var discriminatedUnionType = ZodDiscriminatedUnion.create;
  var intersectionType = ZodIntersection.create;
  var tupleType = ZodTuple.create;
  var recordType = ZodRecord.create;
  var mapType = ZodMap.create;
  var setType = ZodSet.create;
  var functionType = ZodFunction.create;
  var lazyType = ZodLazy.create;
  var literalType = ZodLiteral.create;
  var enumType = ZodEnum.create;
  var nativeEnumType = ZodNativeEnum.create;
  var promiseType = ZodPromise.create;
  var effectsType = ZodEffects.create;
  var optionalType = ZodOptional.create;
  var nullableType = ZodNullable.create;
  var preprocessType = ZodEffects.createWithPreprocess;
  var pipelineType = ZodPipeline.create;
  var ostring = () => stringType().optional();
  var onumber = () => numberType().optional();
  var oboolean = () => booleanType().optional();
  var coerce = {
    string: ((arg) => ZodString.create({ ...arg, coerce: true })),
    number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
    boolean: ((arg) => ZodBoolean.create({
      ...arg,
      coerce: true
    })),
    bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
    date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
  };
  var NEVER = INVALID;

  // packages/core/src/contracts.ts
  var safeTicks = external_exports.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  var identifier = external_exports.string().trim().min(1).max(256);
  var ConnectionMetadataSchema = external_exports.object({
    schemaVersion: external_exports.literal(1),
    serverUrl: external_exports.string().url(),
    serverId: identifier,
    serverName: external_exports.string().trim().min(1).max(256),
    userId: identifier,
    username: external_exports.string().trim().min(1).max(256),
    deviceId: identifier,
    acceptedInsecureRemote: external_exports.boolean(),
    lastConnectedAt: external_exports.string().datetime()
  }).strict();
  var PageSchema = external_exports.object({
    startIndex: external_exports.number().int().nonnegative().default(0),
    limit: external_exports.number().int().min(1).max(200).default(50)
  });
  var CatalogRequestSchema = external_exports.discriminatedUnion("kind", [
    external_exports.object({
      kind: external_exports.literal("libraries")
    }).strict(),
    external_exports.object({
      kind: external_exports.literal("home"),
      shelf: external_exports.enum(["continueWatching", "nextUp", "recentlyAdded"]),
      limit: external_exports.number().int().min(1).max(50).default(20),
      seriesId: identifier.optional()
    }).strict(),
    PageSchema.extend({
      kind: external_exports.literal("library"),
      itemType: external_exports.enum(["Movie", "Series"]),
      parentId: identifier.optional(),
      sortBy: external_exports.enum(["SortName", "DateCreated", "PremiereDate", "CommunityRating"]).default("SortName"),
      sortOrder: external_exports.enum(["Ascending", "Descending"]).default("Ascending")
    }).strict(),
    PageSchema.extend({
      kind: external_exports.literal("search"),
      query: external_exports.string().trim().min(1).max(200),
      includeItemTypes: external_exports.array(external_exports.enum(["Movie", "Series", "Episode"])).min(1).max(3).default(["Movie", "Series"])
    }).strict(),
    external_exports.object({
      kind: external_exports.literal("details"),
      itemId: identifier
    }).strict(),
    PageSchema.extend({
      kind: external_exports.literal("episodes"),
      seriesId: identifier,
      seasonId: identifier.optional()
    }).strict()
  ]);
  var ArtworkRequestSchema = external_exports.object({
    itemId: identifier,
    imageType: external_exports.enum(["Primary", "Backdrop", "Thumb", "Logo"]),
    imageTag: external_exports.string().trim().min(1).max(512).optional(),
    width: external_exports.number().int().min(32).max(2048),
    height: external_exports.number().int().min(32).max(2048),
    quality: external_exports.number().int().min(40).max(95).default(85)
  }).strict().refine(({ width, height }) => width * height <= 4194304, {
    message: "Artwork dimensions exceed the four-megapixel limit"
  });
  var PlaybackRequestSchema = external_exports.object({
    itemId: identifier,
    startPositionTicks: safeTicks.default(0),
    mediaSourceId: identifier.optional(),
    audioStreamIndex: external_exports.number().int().nonnegative().max(1e4).optional(),
    subtitleStreamIndex: external_exports.number().int().min(-1).max(1e4).optional(),
    maxStreamingBitrate: external_exports.number().int().min(1e6).max(1e9).default(12e7),
    openInNewWindow: external_exports.boolean().default(false),
    videoTranscodeApproved: external_exports.boolean().default(false)
  }).strict();
  var PlayMethodSchema = external_exports.enum(["DirectPlay", "DirectStream", "Transcode"]);
  var PlaybackPlanSchema = external_exports.object({
    itemId: identifier,
    playSessionId: identifier,
    mediaSourceId: identifier,
    url: external_exports.string().url(),
    headers: external_exports.record(external_exports.string()),
    playMethod: PlayMethodSchema,
    conversion: external_exports.enum(["none", "container", "audio", "video"]),
    requiresVideoTranscodeConfirmation: external_exports.boolean(),
    transcodeReasons: external_exports.array(external_exports.string()),
    startPositionTicks: safeTicks,
    audioStreamIndex: external_exports.number().int().nonnegative().max(1e4).optional(),
    subtitleStreamIndex: external_exports.number().int().min(-1).max(1e4).optional(),
    externalSubtitle: external_exports.object({
      index: external_exports.number().int().nonnegative(),
      deliveryUrl: external_exports.string().url(),
      codec: external_exports.string().optional(),
      language: external_exports.string().optional(),
      displayTitle: external_exports.string().optional()
    }).strict().optional(),
    runtimeTicks: safeTicks.optional()
  }).strict();
  var PlaybackSessionStateSchema = external_exports.object({
    generation: external_exports.number().int().nonnegative(),
    status: external_exports.enum(["idle", "preparing", "playing", "paused", "stopped", "error"]),
    plan: PlaybackPlanSchema.optional(),
    positionTicks: safeTicks,
    durationTicks: safeTicks.optional(),
    lastProgressReportAtMs: external_exports.number().int().nonnegative().optional(),
    stopReason: external_exports.enum(["completed", "closed", "replaced", "failed", "user"]).optional(),
    errorMessage: external_exports.string().max(2e3).optional()
  }).strict();
  var BridgeOperationSchema = external_exports.enum([
    "connection.probe",
    "connection.login.password",
    "connection.quickConnect.start",
    "connection.quickConnect.poll",
    "connection.disconnect",
    "catalog.query",
    "artwork.fetch",
    "playback.start",
    "playback.stop",
    "catalog.refresh"
  ]);
  var requestId = external_exports.string().trim().min(1).max(128);
  var BridgeRequestSchema = external_exports.discriminatedUnion("operation", [
    external_exports.object({
      operation: external_exports.literal("connection.probe"),
      requestId,
      payload: external_exports.object({
        serverUrl: external_exports.string().min(1).max(2048),
        allowInsecureRemote: external_exports.boolean().default(false)
      }).strict()
    }).strict(),
    external_exports.object({
      operation: external_exports.literal("connection.login.password"),
      requestId,
      payload: external_exports.object({
        serverUrl: external_exports.string().min(1).max(2048),
        username: external_exports.string().min(1).max(256),
        password: external_exports.string().max(4096),
        allowInsecureRemote: external_exports.boolean().default(false)
      }).strict()
    }).strict(),
    external_exports.object({
      operation: external_exports.literal("connection.quickConnect.start"),
      requestId,
      payload: external_exports.object({
        serverUrl: external_exports.string().min(1).max(2048),
        allowInsecureRemote: external_exports.boolean().default(false)
      }).strict()
    }).strict(),
    external_exports.object({
      operation: external_exports.literal("connection.quickConnect.poll"),
      requestId,
      payload: external_exports.object({}).strict()
    }).strict(),
    external_exports.object({
      operation: external_exports.literal("connection.disconnect"),
      requestId,
      payload: external_exports.object({}).strict()
    }).strict(),
    external_exports.object({ operation: external_exports.literal("catalog.query"), requestId, payload: CatalogRequestSchema }).strict(),
    external_exports.object({ operation: external_exports.literal("artwork.fetch"), requestId, payload: ArtworkRequestSchema }).strict(),
    external_exports.object({ operation: external_exports.literal("playback.start"), requestId, payload: PlaybackRequestSchema }).strict(),
    external_exports.object({
      operation: external_exports.literal("playback.stop"),
      requestId,
      payload: external_exports.object({ reason: external_exports.enum(["closed", "replaced", "user"]).default("user") }).strict()
    }).strict(),
    external_exports.object({ operation: external_exports.literal("catalog.refresh"), requestId, payload: external_exports.object({}).strict() }).strict()
  ]);
  var BridgeErrorSchema = external_exports.object({
    code: external_exports.string().trim().min(1).max(128),
    message: external_exports.string().trim().min(1).max(2e3),
    recoverable: external_exports.boolean(),
    details: external_exports.unknown().optional()
  }).strict();
  var BridgeResponseSchema = external_exports.discriminatedUnion("ok", [
    external_exports.object({
      operation: BridgeOperationSchema,
      requestId,
      ok: external_exports.literal(true),
      result: external_exports.unknown()
    }).strict(),
    external_exports.object({
      operation: BridgeOperationSchema,
      requestId,
      ok: external_exports.literal(false),
      error: BridgeErrorSchema
    }).strict()
  ]);

  // packages/core/src/jellyfin-schemas.ts
  var identifier2 = external_exports.string().min(1).max(512);
  var shortText = external_exports.string().max(2e3);
  var imageTags = external_exports.record(external_exports.string().max(512)).transform((value) => Object.fromEntries(Object.entries(value).slice(0, 16)));
  var PublicSystemInfoSchema = external_exports.object({
    Id: identifier2,
    ServerName: external_exports.string().min(1).max(256),
    Version: external_exports.string().min(1).max(128),
    ProductName: external_exports.string().max(256).optional(),
    OperatingSystem: external_exports.string().max(256).optional(),
    StartupWizardCompleted: external_exports.boolean().optional()
  }).strip();
  var AuthenticationResultSchema = external_exports.object({
    User: external_exports.object({
      Id: identifier2,
      Name: external_exports.string().min(1).max(256)
    }).strip(),
    AccessToken: external_exports.string().min(1).max(8192),
    ServerId: identifier2,
    SessionInfo: external_exports.object({ Id: identifier2.optional() }).strip().optional()
  }).strip();
  var PublicMediaStreamSchema = external_exports.object({
    Index: external_exports.number().int().nonnegative(),
    Type: external_exports.enum(["Audio", "Video", "Subtitle", "EmbeddedImage", "Data"]),
    Codec: external_exports.string().max(128).nullable().optional(),
    Language: external_exports.string().max(128).nullable().optional(),
    DisplayTitle: external_exports.string().max(512).nullable().optional(),
    IsDefault: external_exports.boolean().optional(),
    IsExternal: external_exports.boolean().optional()
  }).strip();
  var PublicMediaSourceSummarySchema = external_exports.object({
    Id: identifier2,
    Name: external_exports.string().max(512).optional(),
    Container: external_exports.string().max(128).nullable().optional(),
    MediaStreams: external_exports.array(PublicMediaStreamSchema).max(100).default([])
  }).strip();
  var BaseItemSchema = external_exports.object({
    Id: identifier2,
    Name: external_exports.string().max(2e3),
    Type: external_exports.string().max(128).optional(),
    Overview: external_exports.string().max(2e4).nullable().optional(),
    RunTimeTicks: external_exports.number().int().nonnegative().nullable().optional(),
    ProductionYear: external_exports.number().int().nullable().optional(),
    IndexNumber: external_exports.number().int().nullable().optional(),
    ParentIndexNumber: external_exports.number().int().nullable().optional(),
    SeriesName: shortText.nullable().optional(),
    SeriesId: identifier2.nullable().optional(),
    ParentBackdropItemId: identifier2.nullable().optional(),
    OfficialRating: external_exports.string().max(128).nullable().optional(),
    CommunityRating: external_exports.number().finite().nullable().optional(),
    UnwatchedCount: external_exports.number().int().nonnegative().optional(),
    ImageTags: imageTags.optional(),
    BackdropImageTags: external_exports.array(external_exports.string().max(512)).max(8).optional(),
    MediaSources: external_exports.array(PublicMediaSourceSummarySchema).max(20).optional(),
    UserData: external_exports.object({
      PlaybackPositionTicks: external_exports.number().int().nonnegative().optional(),
      Played: external_exports.boolean().optional(),
      PlayedPercentage: external_exports.number().nonnegative().nullable().optional(),
      UnplayedItemCount: external_exports.number().int().nonnegative().nullable().optional()
    }).strip().optional()
  }).strip();
  var ItemsResultSchema = external_exports.object({
    Items: external_exports.array(BaseItemSchema).max(200),
    TotalRecordCount: external_exports.number().int().nonnegative(),
    StartIndex: external_exports.number().int().nonnegative()
  }).strip();
  var MediaStreamSchema = external_exports.object({
    Index: external_exports.number().int().nonnegative(),
    Type: external_exports.enum(["Audio", "Video", "Subtitle", "EmbeddedImage", "Data"]),
    Codec: external_exports.string().max(128).nullable().optional(),
    Language: external_exports.string().max(128).nullable().optional(),
    DisplayTitle: external_exports.string().max(512).nullable().optional(),
    IsDefault: external_exports.boolean().optional(),
    IsExternal: external_exports.boolean().optional(),
    DeliveryUrl: external_exports.string().max(8192).nullable().optional()
  }).strip();
  var MediaSourceSchema = external_exports.object({
    Id: identifier2,
    Name: external_exports.string().max(512).optional(),
    Protocol: external_exports.string().max(128).optional(),
    Container: external_exports.string().max(128).nullable().optional(),
    Path: external_exports.string().max(8192).nullable().optional(),
    RunTimeTicks: external_exports.number().int().nonnegative().nullable().optional(),
    SupportsDirectPlay: external_exports.boolean().default(false),
    SupportsDirectStream: external_exports.boolean().default(false),
    SupportsTranscoding: external_exports.boolean().default(false),
    TranscodingUrl: external_exports.string().max(16384).nullable().optional(),
    TranscodingContainer: external_exports.string().max(128).nullable().optional(),
    TranscodingSubProtocol: external_exports.string().max(128).nullable().optional(),
    RequiredHttpHeaders: external_exports.record(external_exports.string().max(8192)).refine((headers) => Object.keys(headers).length <= 64, "Too many required HTTP headers").optional(),
    DefaultAudioStreamIndex: external_exports.number().int().nonnegative().nullable().optional(),
    DefaultSubtitleStreamIndex: external_exports.number().int().min(-1).nullable().optional(),
    MediaStreams: external_exports.array(MediaStreamSchema).max(100).default([])
  }).strip();
  var PlaybackInfoResponseSchema = external_exports.object({
    PlaySessionId: identifier2,
    MediaSources: external_exports.array(MediaSourceSchema).min(1).max(20),
    ErrorCode: external_exports.string().max(256).nullable().optional()
  }).strip();

  // packages/core/src/bridge-results.ts
  var identifier3 = external_exports.string().trim().min(1).max(512);
  var publicConnection = external_exports.object({
    serverUrl: external_exports.string().url().max(2048),
    serverId: identifier3,
    serverName: external_exports.string().min(1).max(256),
    userId: identifier3,
    username: external_exports.string().min(1).max(256),
    transport: external_exports.enum(["http", "https"]),
    lastConnectedAt: external_exports.string().datetime({ offset: true })
  }).strip();
  var PublicPlaybackPlanSchema = external_exports.object({
    playMethod: PlayMethodSchema,
    conversion: external_exports.enum(["none", "container", "audio", "video"]),
    requiresVideoTranscodeConfirmation: external_exports.boolean(),
    transcodeReasons: external_exports.array(external_exports.string().max(512)).max(32),
    mediaSourceId: identifier3,
    audioStreamIndex: external_exports.number().int().nonnegative().max(1e4).optional(),
    subtitleStreamIndex: external_exports.number().int().min(-1).max(1e4).optional()
  }).strip();
  var resultSchemas = {
    "connection.probe": external_exports.object({
      server: PublicSystemInfoSchema,
      normalizedUrl: external_exports.string().url().max(2048),
      transportPolicy: external_exports.enum(["https", "local-http-warning", "remote-http-accepted"]),
      isLocal: external_exports.boolean()
    }).strict(),
    "connection.login.password": external_exports.object({ connection: publicConnection }).strict(),
    "connection.quickConnect.start": external_exports.object({
      code: external_exports.string().min(1).max(32),
      serverName: external_exports.string().min(1).max(256),
      expiresInSeconds: external_exports.number().int().min(1).max(3600)
    }).strict(),
    "connection.quickConnect.poll": external_exports.object({ authenticated: external_exports.boolean(), connection: publicConnection.optional() }).strict().superRefine((value, context) => {
      if (value.authenticated && value.connection === void 0) {
        context.addIssue({
          code: external_exports.ZodIssueCode.custom,
          message: "Authenticated Quick Connect results require public connection metadata"
        });
      }
    }),
    "connection.disconnect": external_exports.object({ disconnected: external_exports.literal(true) }).strict(),
    "catalog.query": external_exports.union([BaseItemSchema, ItemsResultSchema, external_exports.array(BaseItemSchema).max(200)]),
    "artwork.fetch": external_exports.object({
      dataUrl: external_exports.string().max(12e6).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    }).strict(),
    "playback.start": external_exports.object({
      status: external_exports.enum(["started", "confirmation-required"]),
      plan: PublicPlaybackPlanSchema
    }).strict(),
    "playback.stop": external_exports.object({ stopped: external_exports.literal(true) }).strict(),
    "catalog.refresh": external_exports.object({
      connection: publicConnection.optional(),
      refreshedAt: external_exports.string().datetime({ offset: true })
    }).strict()
  };
  function parseBridgeResult(operation, value) {
    return resultSchemas[operation].parse(value);
  }

  // packages/core/src/playback.ts
  var PlaybackSelectionError = class extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.name = "PlaybackSelectionError";
      this.code = code;
    }
  };
  function chooseMediaSource(response, requestedId) {
    if (requestedId === void 0) return response.MediaSources[0];
    const selected = response.MediaSources.find((source) => source.Id === requestedId);
    if (selected === void 0) {
      throw new PlaybackSelectionError(
        "MEDIA_SOURCE_NOT_FOUND",
        "The selected media version is no longer available"
      );
    }
    return selected;
  }
  function queryValueCaseInsensitive(url, name) {
    const parsed = new URL(url, "https://jellyfin.invalid");
    const wanted = name.toLowerCase();
    for (const [key, value] of parsed.searchParams) {
      if (key.toLowerCase() === wanted) return value;
    }
    return void 0;
  }
  function transcodeReasonsFromUrl(url) {
    const value = queryValueCaseInsensitive(url, "TranscodeReasons");
    if (value === void 0) return [];
    return value.split(",").map((reason) => reason.trim()).filter((reason) => reason.length > 0).slice(0, 32);
  }
  function staticDirectPlayUrl(context, request, source, playSessionId) {
    const query = new URLSearchParams({
      Static: "true",
      MediaSourceId: source.Id,
      PlaySessionId: playSessionId
    });
    return `${joinJellyfinPath(context.serverUrl, `Videos/${encodeURIComponent(request.itemId)}/stream`)}?${query}`;
  }
  function determineTranscodeConversion(source, transcodeUrl) {
    const containsVideo = source.MediaStreams.some((stream) => stream.Type === "Video");
    if (!containsVideo) return "audio";
    const videoCodec = queryValueCaseInsensitive(transcodeUrl, "VideoCodec")?.toLowerCase();
    const audioCodec = queryValueCaseInsensitive(transcodeUrl, "AudioCodec")?.toLowerCase();
    if (videoCodec !== void 0) {
      if (videoCodec === "copy")
        return audioCodec === void 0 || audioCodec === "copy" ? "container" : "audio";
      return "video";
    }
    const reasons = transcodeReasonsFromUrl(transcodeUrl);
    if (reasons.some((reason) => /video|bitrate|subtitle/i.test(reason))) return "video";
    if (reasons.length > 0 && reasons.every((reason) => /audio/i.test(reason))) return "audio";
    if (reasons.length > 0 && reasons.every((reason) => /container/i.test(reason)))
      return "container";
    return "video";
  }
  function selectedAudioIndex(request, source) {
    if (request.audioStreamIndex !== void 0) return request.audioStreamIndex;
    return source.DefaultAudioStreamIndex ?? void 0;
  }
  function selectedSubtitleIndex(request, source) {
    if (request.subtitleStreamIndex !== void 0) return request.subtitleStreamIndex;
    return source.DefaultSubtitleStreamIndex ?? void 0;
  }
  function requiredHeaders(source, context) {
    const allowedServerHeaders = {};
    for (const [name, value] of Object.entries(source.RequiredHttpHeaders ?? {})) {
      const normalized = name.toLowerCase();
      if (!/^[A-Za-z0-9-]{1,128}$/.test(name) || /[\r\n]/.test(value) || ["authorization", "proxy-authorization", "cookie", "host"].includes(normalized)) {
        continue;
      }
      allowedServerHeaders[name] = value;
    }
    return {
      ...allowedServerHeaders,
      Authorization: createMediaBrowserAuthorization({
        client: context.client ?? DEFAULT_CLIENT_NAME,
        device: context.device ?? DEFAULT_DEVICE_NAME,
        deviceId: context.deviceId,
        version: context.version,
        accessToken: context.accessToken
      })
    };
  }
  function selectPlaybackPlan(rawResponse, request, context) {
    const response = PlaybackInfoResponseSchema.parse(rawResponse);
    const source = chooseMediaSource(response, request.mediaSourceId);
    let url;
    let playMethod;
    let conversion;
    if (source.SupportsDirectPlay) {
      url = staticDirectPlayUrl(context, request, source, response.PlaySessionId);
      playMethod = "DirectPlay";
      conversion = "none";
    } else if (source.SupportsTranscoding && source.TranscodingUrl) {
      url = source.TranscodingUrl;
      conversion = determineTranscodeConversion(source, source.TranscodingUrl);
      playMethod = source.SupportsDirectStream && conversion !== "video" ? "DirectStream" : "Transcode";
    } else {
      throw new PlaybackSelectionError(
        "NO_PLAYABLE_URL",
        "Jellyfin did not return a playable URL for this media version"
      );
    }
    const audioStreamIndex = selectedAudioIndex(request, source);
    const subtitleStreamIndex = selectedSubtitleIndex(request, source);
    const plan = {
      itemId: request.itemId,
      playSessionId: response.PlaySessionId,
      mediaSourceId: source.Id,
      url: resolveJellyfinUrl(context.serverUrl, url),
      headers: requiredHeaders(source, context),
      playMethod,
      conversion,
      requiresVideoTranscodeConfirmation: conversion === "video",
      transcodeReasons: source.TranscodingUrl == null ? [] : transcodeReasonsFromUrl(source.TranscodingUrl),
      startPositionTicks: request.startPositionTicks
    };
    if (audioStreamIndex !== void 0) plan.audioStreamIndex = audioStreamIndex;
    if (subtitleStreamIndex !== void 0) plan.subtitleStreamIndex = subtitleStreamIndex;
    if (source.RunTimeTicks != null) plan.runtimeTicks = source.RunTimeTicks;
    if (subtitleStreamIndex !== void 0 && subtitleStreamIndex >= 0) {
      const subtitle = source.MediaStreams.find(
        (stream) => stream.Type === "Subtitle" && stream.Index === subtitleStreamIndex && stream.IsExternal === true
      );
      if (subtitle?.DeliveryUrl) {
        const externalSubtitle = {
          index: subtitle.Index,
          deliveryUrl: resolveJellyfinUrl(context.serverUrl, subtitle.DeliveryUrl)
        };
        if (subtitle.Codec) externalSubtitle.codec = subtitle.Codec;
        if (subtitle.Language) externalSubtitle.language = subtitle.Language;
        if (subtitle.DisplayTitle) externalSubtitle.displayTitle = subtitle.DisplayTitle;
        plan.externalSubtitle = externalSubtitle;
      }
    }
    return PlaybackPlanSchema.parse(plan);
  }

  // packages/core/src/redaction.ts
  var REDACTED = "[REDACTED]";
  var SECRET_KEY = /(?:authorization|x-emby-token|token|api[_-]?key|password|passwd|\bpw|secret)$/i;
  var SECRET_QUERY_KEY = /^(?:api[_-]?key|access[_-]?token|token|x-emby-token|password|secret)$/i;
  function redactUrl(value) {
    try {
      const url = new URL(value);
      let changed = false;
      if (url.password !== "") {
        url.password = REDACTED;
        changed = true;
      }
      for (const key of [...url.searchParams.keys()]) {
        if (SECRET_QUERY_KEY.test(key)) {
          url.searchParams.set(key, REDACTED);
          changed = true;
        }
      }
      return changed ? url.toString() : void 0;
    } catch {
      return void 0;
    }
  }
  function redactString(value) {
    const wholeUrl = redactUrl(value);
    if (wholeUrl !== void 0) return wholeUrl;
    return value.replace(
      /([?&](?:api[_-]?key|access[_-]?token|token|x-emby-token|password|secret)=)([^&#\s]*)/gi,
      (_match, prefix) => `${prefix}${encodeURIComponent(REDACTED)}`
    ).replace(/(MediaBrowser\s+[^\r\n]*?\bToken=")[^"]*(")/gi, `$1${REDACTED}$2`).replace(/(Bearer\s+)[^\s,]+/gi, `$1${REDACTED}`).replace(/(Authorization:\s*Basic\s+)[^\s,]+/gi, `$1${REDACTED}`);
  }
  function redactSecrets(input) {
    const seen = /* @__PURE__ */ new WeakMap();
    const visit = (value) => {
      if (typeof value === "string") return redactString(value);
      if (value === null || typeof value !== "object") return value;
      if (value instanceof Date) return new Date(value.getTime());
      if (seen.has(value)) return "[CIRCULAR]";
      if (Array.isArray(value)) {
        const output2 = [];
        seen.set(value, output2);
        for (const item of value) output2.push(visit(item));
        return output2;
      }
      const output = {};
      seen.set(value, output);
      for (const [key, item] of Object.entries(value)) {
        output[key] = SECRET_KEY.test(key) ? REDACTED : visit(item);
      }
      return output;
    };
    return visit(input);
  }

  // packages/plugin/src/constants.ts
  var PLUGIN_VERSION = "0.1.0";
  var KEYCHAIN_SERVICE = "jellyfin-access-token";
  var CONNECTION_PREFERENCE_KEY = "connectionMetadata";
  var DEVICE_ID_PREFERENCE_KEY = "deviceId";
  var MANAGED_PLAYER_LABEL = "jellyfin-managed-player";
  var PLUGIN_PLAYBACK_SCHEME = "iina-jellyfin:";
  var BRIDGE_REQUEST_MESSAGE = "bridge.request";
  var BRIDGE_RESPONSE_MESSAGE = "bridge.response";
  var DEFAULT_ARTWORK_LIMIT_BYTES = 8 * 1024 * 1024;
  var PLAYER_MESSAGES = {
    catalogOpen: "jellyfin.catalog.open",
    closed: "jellyfin.player.closed",
    plan: "jellyfin.player.plan",
    planRequest: "jellyfin.player.plan-request",
    playNext: "jellyfin.player.play-next",
    replace: "jellyfin.player.replace",
    state: "jellyfin.player.state",
    stop: "jellyfin.player.stop",
    upNext: "jellyfin.player.up-next"
  };

  // packages/plugin/src/base64.ts
  var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function bytesToBase64(bytes) {
    let output = "";
    for (let index = 0; index < bytes.length; index += 3) {
      const first = bytes[index] ?? 0;
      const second = bytes[index + 1] ?? 0;
      const third = bytes[index + 2] ?? 0;
      const combined = first << 16 | second << 8 | third;
      output += ALPHABET[combined >> 18 & 63];
      output += ALPHABET[combined >> 12 & 63];
      output += index + 1 < bytes.length ? ALPHABET[combined >> 6 & 63] : "=";
      output += index + 2 < bytes.length ? ALPHABET[combined & 63] : "=";
    }
    return output;
  }
  function detectImageMimeType(bytes) {
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
    if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
      return "image/png";
    }
    if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
      return "image/webp";
    }
    if (String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavif")) return "image/avif";
    return "application/octet-stream";
  }

  // packages/plugin/src/artwork-cache.ts
  var INDEX_PATH = "@data/artwork-index.json";
  var CACHE_PREFIX = "@data/artwork-";
  var DEFAULT_TOTAL_BYTES = 50 * 1024 * 1024;
  var MIN_TOTAL_BYTES = DEFAULT_ARTWORK_LIMIT_BYTES;
  var MAX_TOTAL_BYTES = 512 * 1024 * 1024;
  var DEFAULT_CONCURRENT_DOWNLOADS = 4;
  var MAX_CONCURRENT_DOWNLOADS = 8;
  function clampArtworkCacheLimit(value) {
    if (!Number.isFinite(value)) return DEFAULT_TOTAL_BYTES;
    return Math.min(MAX_TOTAL_BYTES, Math.max(MIN_TOTAL_BYTES, Math.trunc(value)));
  }
  function clampSingleArtworkLimit(value) {
    if (!Number.isFinite(value)) return DEFAULT_ARTWORK_LIMIT_BYTES;
    return Math.min(DEFAULT_ARTWORK_LIMIT_BYTES, Math.max(1, Math.trunc(value)));
  }
  function clampConcurrentDownloads(value) {
    if (!Number.isFinite(value)) return DEFAULT_CONCURRENT_DOWNLOADS;
    return Math.min(MAX_CONCURRENT_DOWNLOADS, Math.max(1, Math.trunc(value)));
  }
  function canonicalCacheKey(request, context) {
    const serverUrl = normalizeServerUrl(context.serverUrl, { allowInsecureRemote: true }).url;
    return JSON.stringify([
      serverUrl,
      context.userId,
      request.itemId,
      request.imageType,
      request.imageTag ?? "",
      request.width,
      request.height,
      request.quality
    ]);
  }
  function cacheKey(source) {
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function cachePath(key) {
    return `${CACHE_PREFIX}${key}.bin`;
  }
  function emptyIndex() {
    return { version: 2, entries: {} };
  }
  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function isCacheEntry(value, key) {
    if (!isRecord(value)) return false;
    return typeof value.canonicalKey === "string" && value.canonicalKey.length > 0 && value.path === cachePath(key) && typeof value.bytes === "number" && Number.isSafeInteger(value.bytes) && value.bytes > 0 && typeof value.lastAccessAt === "number" && Number.isFinite(value.lastAccessAt) && value.lastAccessAt >= 0;
  }
  var ArtworkCache = class {
    constructor(file, transport2, maxTotalBytes = DEFAULT_TOTAL_BYTES, maxSingleBytes = DEFAULT_ARTWORK_LIMIT_BYTES, maxConcurrentDownloads = DEFAULT_CONCURRENT_DOWNLOADS) {
      this.file = file;
      this.transport = transport2;
      this.maxTotalBytes = clampArtworkCacheLimit(maxTotalBytes);
      this.maxSingleBytes = clampSingleArtworkLimit(maxSingleBytes);
      this.maxConcurrentDownloads = clampConcurrentDownloads(maxConcurrentDownloads);
      this.index = this.loadIndex();
    }
    file;
    transport;
    maxTotalBytes;
    maxSingleBytes;
    maxConcurrentDownloads;
    inFlight = /* @__PURE__ */ new Map();
    slotLocks = /* @__PURE__ */ new Map();
    downloadWaiters = [];
    activeDownloads = 0;
    index;
    async fetchDataUrl(rawRequest, context) {
      const request = ArtworkRequestSchema.parse(rawRequest);
      const canonicalKey = canonicalCacheKey(request, context);
      const pending = this.inFlight.get(canonicalKey);
      if (pending !== void 0) return pending;
      const operation = this.fetchCanonical(request, context, canonicalKey);
      this.inFlight.set(canonicalKey, operation);
      try {
        return await operation;
      } finally {
        if (this.inFlight.get(canonicalKey) === operation) this.inFlight.delete(canonicalKey);
      }
    }
    async fetchCanonical(request, context, canonicalKey) {
      const key = cacheKey(canonicalKey);
      return this.withSlotLock(key, async () => {
        const cached = this.readCached(key, canonicalKey);
        if (cached !== void 0) return cached;
        const destination = cachePath(key);
        let bytes;
        const releaseDownload = await this.acquireDownloadSlot();
        try {
          await this.transport.download(buildArtworkHttpRequest(request, context), destination);
          bytes = this.readBounded(destination);
          const mime = detectImageMimeType(bytes);
          if (!mime.startsWith("image/")) {
            throw new Error("Jellyfin returned a non-image artwork response.");
          }
        } catch (error) {
          this.deleteManagedFile(key, destination);
          throw error;
        } finally {
          releaseDownload();
        }
        this.index.entries[key] = {
          canonicalKey,
          path: destination,
          bytes: bytes.byteLength,
          lastAccessAt: Date.now()
        };
        this.evict();
        this.persistIndex();
        return this.toDataUrl(bytes);
      });
    }
    readCached(key, canonicalKey) {
      const existing = this.index.entries[key];
      if (existing === void 0) return void 0;
      if (existing.canonicalKey !== canonicalKey || !this.file.exists(existing.path)) {
        this.invalidateEntry(key, existing);
        return void 0;
      }
      try {
        const bytes = this.readBounded(existing.path);
        const result = this.toDataUrl(bytes);
        existing.lastAccessAt = Date.now();
        this.persistIndex();
        return result;
      } catch {
        this.invalidateEntry(key, existing);
        return void 0;
      }
    }
    async withSlotLock(key, operation) {
      const previous = this.slotLocks.get(key) ?? Promise.resolve();
      let release = () => void 0;
      const current = new Promise((resolve) => {
        release = resolve;
      });
      this.slotLocks.set(key, current);
      await previous.catch(() => void 0);
      try {
        return await operation();
      } finally {
        release();
        if (this.slotLocks.get(key) === current) this.slotLocks.delete(key);
      }
    }
    async acquireDownloadSlot() {
      if (this.activeDownloads < this.maxConcurrentDownloads && this.downloadWaiters.length === 0) {
        this.activeDownloads += 1;
      } else {
        await new Promise(
          (resolve) => this.downloadWaiters.push(() => {
            this.activeDownloads += 1;
            resolve();
          })
        );
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.activeDownloads -= 1;
        this.downloadWaiters.shift()?.();
      };
    }
    readBounded(path) {
      const handle = this.file.handle(path, "read");
      try {
        const bytes = handle.readToEnd();
        if (bytes === void 0 || bytes.byteLength === 0)
          throw new Error("Artwork download was empty.");
        if (bytes.byteLength > this.maxSingleBytes) {
          throw new Error("Artwork exceeded the per-image cache limit.");
        }
        return bytes;
      } finally {
        handle.close();
      }
    }
    toDataUrl(bytes) {
      const mime = detectImageMimeType(bytes);
      return `data:${mime};base64,${bytesToBase64(bytes)}`;
    }
    loadIndex() {
      const raw = this.file.read(INDEX_PATH);
      if (raw === void 0) return emptyIndex();
      try {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed) || parsed.version !== 2 || !isRecord(parsed.entries)) {
          this.purgeLegacyEntries(parsed);
          return emptyIndex();
        }
        const entries = {};
        for (const [key, value] of Object.entries(parsed.entries)) {
          if (/^[0-9a-f]{8}$/.test(key) && isCacheEntry(value, key)) entries[key] = value;
        }
        return { version: 2, entries };
      } catch {
        return emptyIndex();
      }
    }
    purgeLegacyEntries(parsed) {
      if (!isRecord(parsed) || !isRecord(parsed.entries)) return;
      for (const [key, value] of Object.entries(parsed.entries)) {
        if (!/^[0-9a-f]{8}$/.test(key) || !isRecord(value)) continue;
        if (value.path === cachePath(key)) this.deleteManagedFile(key, value.path);
      }
    }
    persistIndex() {
      this.file.write(INDEX_PATH, JSON.stringify(this.index));
    }
    invalidateEntry(key, entry) {
      this.deleteManagedFile(key, entry.path);
      delete this.index.entries[key];
      this.persistIndex();
    }
    deleteManagedFile(key, path) {
      if (path === cachePath(key) && this.file.exists(path)) this.file.delete(path);
    }
    evict() {
      const entries = Object.entries(this.index.entries).sort(
        ([, left], [, right]) => left.lastAccessAt - right.lastAccessAt
      );
      let total = entries.reduce((sum, [, entry]) => sum + entry.bytes, 0);
      for (const [key, entry] of entries) {
        if (total <= this.maxTotalBytes) break;
        this.deleteManagedFile(key, entry.path);
        total -= entry.bytes;
        delete this.index.entries[key];
      }
    }
  };

  // packages/plugin/src/ids.ts
  function randomHex(length) {
    let output = "";
    while (output.length < length) {
      output += Math.floor(Math.random() * 65536).toString(16).padStart(4, "0");
    }
    return output.slice(0, length);
  }
  function createOpaqueId(prefix = "id") {
    const time = Date.now().toString(36);
    return `${prefix}-${time}-${randomHex(20)}`;
  }
  function createStableDeviceId() {
    return `iina-${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${randomHex(3)}-${randomHex(12)}`;
  }

  // packages/plugin/src/iina-http.ts
  var JellyfinHttpError = class extends Error {
    constructor(statusCode, recoverable, message) {
      super(message);
      this.statusCode = statusCode;
      this.recoverable = recoverable;
      this.name = "JellyfinHttpError";
    }
    statusCode;
    recoverable;
  };
  function responseBody(response) {
    if (response.data !== null) return response.data;
    if (response.text.trim() === "") return void 0;
    try {
      return JSON.parse(response.text);
    } catch {
      throw new JellyfinHttpError(
        response.statusCode,
        true,
        "The Jellyfin server returned an unreadable response."
      );
    }
  }
  function safeStatusMessage(response) {
    if (response.statusCode === 401 || response.statusCode === 403) {
      return "The Jellyfin session has expired. Please reconnect.";
    }
    if (response.statusCode === 404) return "The requested Jellyfin item is no longer available.";
    if (response.statusCode === 429) return "Jellyfin is busy. Please try again shortly.";
    if (response.statusCode >= 500) return "Jellyfin is temporarily unavailable.";
    return `Jellyfin request failed (${response.statusCode}).`;
  }
  var IinaHttpTransport = class {
    constructor(api2) {
      this.api = api2;
    }
    api;
    async execute(request) {
      const data = request.body !== null && typeof request.body === "object" ? request.body : {};
      const options = {
        params: {},
        headers: request.headers,
        data
      };
      let response;
      try {
        response = request.method === "GET" ? await this.api.get(request.url, options) : await this.api.post(request.url, options);
      } catch {
        throw new JellyfinHttpError(0, true, "Could not reach the Jellyfin server.");
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new JellyfinHttpError(
          response.statusCode,
          response.statusCode === 0 || response.statusCode === 408 || response.statusCode === 429 || response.statusCode >= 500,
          safeStatusMessage(response)
        );
      }
      return responseBody(response);
    }
    async download(request, destination) {
      try {
        await this.api.download(request.url, destination, {
          method: request.method,
          params: {},
          headers: request.headers,
          data: request.body !== null && typeof request.body === "object" ? request.body : {}
        });
      } catch {
        throw new JellyfinHttpError(
          0,
          true,
          `Could not download media from ${redactString(new URL(request.url).origin)}.`
        );
      }
    }
  };

  // packages/plugin/src/jellyfin-client.ts
  function requiredString(record, key) {
    const value = record[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Jellyfin response is missing ${key}.`);
    }
    return value;
  }
  function recordValue(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Jellyfin returned an unexpected response.");
    }
    return value;
  }
  var JellyfinClient = class {
    constructor(transport2, identity) {
      this.transport = transport2;
      this.identity = identity;
    }
    transport;
    identity;
    async probe(serverInput, allowInsecureRemote = false) {
      const address = normalizeServerUrl(serverInput, { allowInsecureRemote });
      const raw = await this.transport.execute(buildPublicServerInfoRequest(address.url));
      return { address, server: PublicSystemInfoSchema.parse(raw) };
    }
    async loginWithPassword(input) {
      const { address, server } = await this.probe(input.serverUrl, input.allowInsecureRemote);
      const raw = await this.transport.execute(
        buildPasswordAuthenticationRequest(address.url, this.identity, {
          username: input.username,
          password: input.password
        })
      );
      const authentication = AuthenticationResultSchema.parse(raw);
      return {
        metadata: {
          schemaVersion: 1,
          serverUrl: address.url,
          serverId: authentication.ServerId || server.Id,
          serverName: server.ServerName,
          userId: authentication.User.Id,
          username: authentication.User.Name,
          deviceId: this.identity.deviceId,
          acceptedInsecureRemote: address.policy === "remote-http-accepted" && input.allowInsecureRemote,
          lastConnectedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        accessToken: authentication.AccessToken
      };
    }
    async startQuickConnect(input) {
      const { address, server } = await this.probe(input.serverUrl, input.allowInsecureRemote);
      const raw = recordValue(
        await this.transport.execute(buildQuickConnectInitiateRequest(address.url, this.identity))
      );
      return {
        serverUrl: address.url,
        server,
        secret: requiredString(raw, "Secret"),
        code: requiredString(raw, "Code"),
        allowInsecureRemote: input.allowInsecureRemote,
        startedAt: Date.now()
      };
    }
    async pollQuickConnect(attempt) {
      if (Date.now() - attempt.startedAt > 10 * 60 * 1e3) {
        throw new Error("The Quick Connect code expired. Start again for a new code.");
      }
      const statusRaw = recordValue(
        await this.transport.execute(
          buildQuickConnectStatusRequest(attempt.serverUrl, this.identity, attempt.secret)
        )
      );
      const status = {
        Authenticated: statusRaw.Authenticated === true
      };
      if (!status.Authenticated) return { authenticated: false };
      const raw = await this.transport.execute(
        buildQuickConnectAuthenticationRequest(attempt.serverUrl, this.identity, attempt.secret)
      );
      const authentication = AuthenticationResultSchema.parse(raw);
      const address = normalizeServerUrl(attempt.serverUrl, {
        allowInsecureRemote: attempt.allowInsecureRemote
      });
      return {
        authenticated: true,
        metadata: {
          schemaVersion: 1,
          serverUrl: attempt.serverUrl,
          serverId: authentication.ServerId || attempt.server.Id,
          serverName: attempt.server.ServerName,
          userId: authentication.User.Id,
          username: authentication.User.Name,
          deviceId: this.identity.deviceId,
          acceptedInsecureRemote: address.policy === "remote-http-accepted" && attempt.allowInsecureRemote,
          lastConnectedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        accessToken: authentication.AccessToken
      };
    }
    async queryCatalog(request, context) {
      const raw = await this.transport.execute(buildCatalogRequest(request, context));
      if (request.kind === "details") return BaseItemSchema.parse(raw);
      if (request.kind === "home" && request.shelf === "recentlyAdded" && Array.isArray(raw)) {
        return raw.map((item) => BaseItemSchema.parse(item));
      }
      return ItemsResultSchema.parse(raw);
    }
    async createPlaybackPlan(request, context) {
      const response = PlaybackInfoResponseSchema.parse(
        await this.transport.execute(buildPlaybackInfoRequest(request, context))
      );
      return selectPlaybackPlan(response, request, context);
    }
  };

  // packages/plugin/src/persistence.ts
  function keychainAccount(metadata) {
    return `${metadata.serverId}:${metadata.userId}`;
  }
  var ConnectionStore = class {
    constructor(preferences, keychain) {
      this.preferences = preferences;
      this.keychain = keychain;
    }
    preferences;
    keychain;
    getDeviceId() {
      const current = this.preferences.get(DEVICE_ID_PREFERENCE_KEY);
      if (typeof current === "string" && current.length >= 16) return current;
      const created = createStableDeviceId();
      this.preferences.set(DEVICE_ID_PREFERENCE_KEY, created);
      this.preferences.sync();
      return created;
    }
    readMetadata() {
      const value = this.preferences.get(CONNECTION_PREFERENCE_KEY);
      if (typeof value !== "string" || value.trim() === "") return void 0;
      try {
        return ConnectionMetadataSchema.parse(JSON.parse(value));
      } catch {
        return void 0;
      }
    }
    readAccessToken(metadata) {
      const value = this.keychain.keyChainRead(KEYCHAIN_SERVICE, keychainAccount(metadata));
      if (typeof value !== "string" || value.length === 0) return void 0;
      try {
        const envelope = JSON.parse(value);
        return envelope.version === 1 && envelope.serverUrl === metadata.serverUrl && envelope.serverId === metadata.serverId && envelope.userId === metadata.userId && typeof envelope.accessToken === "string" && envelope.accessToken.length > 0 ? envelope.accessToken : void 0;
      } catch {
        return void 0;
      }
    }
    save(metadata, accessToken) {
      if (accessToken.length === 0) throw new TypeError("Access token cannot be empty");
      const validated = ConnectionMetadataSchema.parse(metadata);
      const previousMetadata = this.readMetadata();
      const account = keychainAccount(validated);
      const previousCredential = this.keychain.keyChainRead(KEYCHAIN_SERVICE, account);
      const previousAccount = previousMetadata === void 0 ? void 0 : keychainAccount(previousMetadata);
      const previousAccountCredential = previousAccount === void 0 || previousAccount === account ? false : this.keychain.keyChainRead(KEYCHAIN_SERVICE, previousAccount);
      const envelope = {
        version: 1,
        serverUrl: validated.serverUrl,
        serverId: validated.serverId,
        userId: validated.userId,
        accessToken
      };
      if (!this.keychain.keyChainWrite(KEYCHAIN_SERVICE, account, JSON.stringify(envelope))) {
        throw new Error("macOS Keychain did not accept the Jellyfin access token.");
      }
      let previousAccountCleared = false;
      if (previousAccount !== void 0 && previousAccount !== account && typeof previousAccountCredential === "string" && previousAccountCredential.length > 0) {
        if (!this.keychain.keyChainWrite(KEYCHAIN_SERVICE, previousAccount, "")) {
          this.keychain.keyChainWrite(
            KEYCHAIN_SERVICE,
            account,
            typeof previousCredential === "string" ? previousCredential : ""
          );
          throw new Error("macOS Keychain did not remove the previous Jellyfin access token.");
        }
        previousAccountCleared = true;
      }
      const previousPreference = this.preferences.get(CONNECTION_PREFERENCE_KEY);
      try {
        this.preferences.set(CONNECTION_PREFERENCE_KEY, JSON.stringify(validated));
        this.preferences.sync();
      } catch (error) {
        if (previousAccountCleared && previousAccount !== void 0) {
          this.keychain.keyChainWrite(
            KEYCHAIN_SERVICE,
            previousAccount,
            previousAccountCredential
          );
        }
        this.keychain.keyChainWrite(
          KEYCHAIN_SERVICE,
          account,
          typeof previousCredential === "string" ? previousCredential : ""
        );
        this.preferences.set(CONNECTION_PREFERENCE_KEY, previousPreference ?? "");
        this.preferences.sync();
        throw error;
      }
    }
    clear() {
      const metadata = this.readMetadata();
      if (metadata !== void 0) {
        const account = keychainAccount(metadata);
        const credential = this.keychain.keyChainRead(KEYCHAIN_SERVICE, account);
        if (typeof credential === "string" && credential.length > 0 && !this.keychain.keyChainWrite(KEYCHAIN_SERVICE, account, "")) {
          throw new Error("macOS Keychain did not remove the Jellyfin access token.");
        }
      }
      this.preferences.set(CONNECTION_PREFERENCE_KEY, "");
      this.preferences.sync();
    }
  };

  // packages/plugin/src/player-messages.ts
  function displayMetadataFromItem(item) {
    const display = { title: item.Name };
    if (item.SeriesName != null) display.seriesName = item.SeriesName;
    if (item.ParentIndexNumber != null) display.seasonNumber = item.ParentIndexNumber;
    if (item.IndexNumber != null) display.episodeNumber = item.IndexNumber;
    if (item.Overview != null) display.overview = item.Overview;
    if (item.RunTimeTicks != null) display.runtimeTicks = item.RunTimeTicks;
    return display;
  }
  function publicPlaybackResult(plan) {
    return {
      playMethod: plan.playMethod,
      conversion: plan.conversion,
      requiresVideoTranscodeConfirmation: plan.requiresVideoTranscodeConfirmation,
      transcodeReasons: plan.transcodeReasons,
      mediaSourceId: plan.mediaSourceId,
      audioStreamIndex: plan.audioStreamIndex,
      subtitleStreamIndex: plan.subtitleStreamIndex
    };
  }

  // packages/plugin/src/safe-logger.ts
  function serialize(value) {
    if (typeof value === "string") return String(redactSecrets(value));
    try {
      return JSON.stringify(redactSecrets(value));
    } catch {
      return "[unserializable]";
    }
  }
  var SafeLogger = class {
    constructor(sink) {
      this.sink = sink;
    }
    sink;
    info(message, context) {
      this.sink.log(context === void 0 ? message : `${message} ${serialize(context)}`);
    }
    warn(message, context) {
      this.sink.warn(context === void 0 ? message : `${message} ${serialize(context)}`);
    }
    error(message, context) {
      this.sink.error(context === void 0 ? message : `${message} ${serialize(context)}`);
    }
  };

  // packages/plugin/src/global.ts
  var api = iina;
  var logger = new SafeLogger({
    log: (message) => api.console.log(message),
    warn: (message) => api.console.warn(message),
    error: (message) => api.console.error(message)
  });
  var transport = new IinaHttpTransport(api.http);
  var connectionStore = new ConnectionStore(api.preferences, api.utils);
  var client = new JellyfinClient(transport, {
    deviceId: connectionStore.getDeviceId(),
    version: PLUGIN_VERSION
  });
  var artworkCache = new ArtworkCache(
    api.file,
    transport,
    Number(api.preferences.get("artworkCacheMaxBytes")) || 50 * 1024 * 1024
  );
  var quickConnectAttempt;
  var quickConnectGeneration = 0;
  var connectionGeneration = 0;
  var managedPlayerId;
  var managedPlayerReference;
  var managedPlaybackSequence = 0;
  var pendingLaunches = /* @__PURE__ */ new Map();
  var createdPlayerIds = /* @__PURE__ */ new Set();
  var playerReferences = /* @__PURE__ */ new Set();
  var playerIdByReference = /* @__PURE__ */ new Map();
  var completedGenerations = /* @__PURE__ */ new Set();
  var catalogPlaybackStates = /* @__PURE__ */ new Map();
  var catalogInvalidationKeys = /* @__PURE__ */ new Set();
  var closedGenerations = /* @__PURE__ */ new Set();
  var pendingCatalogConfirmation;
  var PENDING_LAUNCH_TTL_MS = 3e4;
  var DEDUPE_RETENTION_MS = 6e4;
  function staleRequest() {
    const error = new Error("The connection changed before this request completed.");
    error.code = "STALE_CONNECTION";
    return error;
  }
  function assertConnectionGeneration(generation) {
    if (generation !== connectionGeneration) throw staleRequest();
  }
  function stalePlaybackRequest() {
    const error = new Error("A newer playback request replaced this one.");
    error.code = "STALE_PLAYBACK_REQUEST";
    return error;
  }
  function assertManagedPlaybackSequence(sequence) {
    if (sequence !== void 0 && sequence !== managedPlaybackSequence) {
      throw stalePlaybackRequest();
    }
  }
  function playerHasReference(playerId) {
    for (const referencedId of playerIdByReference.values()) {
      if (referencedId === playerId) return true;
    }
    return false;
  }
  function prunePendingLaunches() {
    const cutoff = Date.now() - PENDING_LAUNCH_TTL_MS;
    const possiblyOrphanedPlayers = /* @__PURE__ */ new Set();
    for (const [nonce, pending] of pendingLaunches) {
      const superseded = pending.managed && pending.managedSequence !== managedPlaybackSequence;
      if (pending.createdAt <= cutoff || pending.generation !== connectionGeneration || superseded) {
        pendingLaunches.delete(nonce);
        if (pending.createdPlayer && pending.playerId !== void 0) {
          possiblyOrphanedPlayers.add(pending.playerId);
        }
      }
    }
    for (const playerId of possiblyOrphanedPlayers) {
      const stillPending = [...pendingLaunches.values()].some(
        (pending) => pending.playerId === playerId
      );
      if (stillPending || playerHasReference(playerId)) continue;
      api.global.postMessage(playerId, PLAYER_MESSAGES.stop, { reason: "closed" });
      createdPlayerIds.delete(playerId);
      if (managedPlayerId === playerId) {
        managedPlayerId = void 0;
        managedPlayerReference = void 0;
      }
    }
  }
  function registerPendingLaunch(nonce, pending) {
    pendingLaunches.set(nonce, pending);
    setTimeout(() => {
      if (pendingLaunches.get(nonce) === pending) prunePendingLaunches();
    }, PENDING_LAUNCH_TTL_MS + 100);
  }
  function discardPendingLaunchesForPlayer(playerId) {
    for (const [nonce, pending] of pendingLaunches) {
      if (pending.playerId === playerId) pendingLaunches.delete(nonce);
    }
  }
  function invalidateCatalogOnce(player, generation, transition, reason, state) {
    const key = `${player}:${generation}:${transition}`;
    if (catalogInvalidationKeys.has(key)) return;
    catalogInvalidationKeys.add(key);
    api.standaloneWindow.postMessage("catalog.invalidated", { reason, state });
  }
  function releasePlayerDedupeState(player) {
    setTimeout(() => {
      for (const key of catalogInvalidationKeys) {
        if (key.startsWith(`${player}:`)) catalogInvalidationKeys.delete(key);
      }
      for (const key of completedGenerations) {
        if (key.startsWith(`${player}:`)) completedGenerations.delete(key);
      }
      for (const key of closedGenerations) {
        if (key.startsWith(`${player}:`)) closedGenerations.delete(key);
      }
    }, DEDUPE_RETENTION_MS);
  }
  function stopAndForgetPlayers(reason) {
    managedPlaybackSequence += 1;
    for (const playerId of createdPlayerIds) {
      api.global.postMessage(playerId, PLAYER_MESSAGES.stop, { reason });
    }
    createdPlayerIds.clear();
    playerReferences.clear();
    playerIdByReference.clear();
    catalogPlaybackStates.clear();
    completedGenerations.clear();
    catalogInvalidationKeys.clear();
    closedGenerations.clear();
    pendingCatalogConfirmation = void 0;
    managedPlayerId = void 0;
    managedPlayerReference = void 0;
  }
  function beginAuthenticationAttempt() {
    connectionGeneration += 1;
    connectionStore.clear();
    quickConnectAttempt = void 0;
    quickConnectGeneration = connectionGeneration;
    pendingLaunches.clear();
    pendingCatalogConfirmation = void 0;
    stopAndForgetPlayers("closed");
    return connectionGeneration;
  }
  function publicConnection2(metadata) {
    if (metadata === void 0) return void 0;
    return {
      serverUrl: metadata.serverUrl,
      serverId: metadata.serverId,
      serverName: metadata.serverName,
      userId: metadata.userId,
      username: metadata.username,
      transport: metadata.serverUrl.startsWith("https:") ? "https" : "http",
      lastConnectedAt: metadata.lastConnectedAt
    };
  }
  function authenticatedContext() {
    const metadata = connectionStore.readMetadata();
    if (metadata === void 0) throw new Error("Connect to Jellyfin before browsing your library.");
    const accessToken = connectionStore.readAccessToken(metadata);
    if (accessToken === void 0)
      throw new Error("The Jellyfin session is missing. Please reconnect.");
    return {
      serverUrl: metadata.serverUrl,
      userId: metadata.userId,
      accessToken,
      deviceId: metadata.deviceId,
      version: PLUGIN_VERSION
    };
  }
  function bridgeError(error) {
    if (error instanceof JellyfinHttpError) {
      return {
        code: error.statusCode === 401 || error.statusCode === 403 ? "AUTH_EXPIRED" : "NETWORK_ERROR",
        message: error.message,
        recoverable: error.recoverable
      };
    }
    if (error instanceof Error) {
      const code = "code" in error && typeof error.code === "string" ? error.code : "REQUEST_FAILED";
      return { code, message: error.message, recoverable: true };
    }
    if (error !== null && typeof error === "object") {
      const candidate = error;
      if (typeof candidate.code === "string" && typeof candidate.message === "string") {
        return {
          code: candidate.code,
          message: candidate.message,
          recoverable: candidate.recoverable !== false
        };
      }
    }
    return {
      code: "REQUEST_FAILED",
      message: "The request could not be completed.",
      recoverable: true
    };
  }
  function respond(request, result) {
    const safeResult = parseBridgeResult(request.operation, result);
    const response = {
      operation: request.operation,
      requestId: request.requestId,
      ok: true,
      result: safeResult
    };
    api.standaloneWindow.postMessage(BRIDGE_RESPONSE_MESSAGE, response);
  }
  function respondError(request, error) {
    const response = {
      operation: request.operation,
      requestId: request.requestId,
      ok: false,
      error: bridgeError(error)
    };
    api.standaloneWindow.postMessage(BRIDGE_RESPONSE_MESSAGE, response);
  }
  async function prepareLaunch(request) {
    const generation = connectionGeneration;
    const context = authenticatedContext();
    const [plan, details] = await Promise.all([
      client.createPlaybackPlan(request, context),
      client.queryCatalog({ kind: "details", itemId: request.itemId }, context)
    ]);
    assertConnectionGeneration(generation);
    const nonce = createOpaqueId("play");
    const launch = {
      nonce,
      plan,
      context,
      display: displayMetadataFromItem(BaseItemSchema.parse(details))
    };
    return { launch, publicPlan: publicPlaybackResult(plan) };
  }
  async function launchPlayback(request) {
    pendingCatalogConfirmation = void 0;
    const managedSequence = request.openInNewWindow ? void 0 : ++managedPlaybackSequence;
    const { launch, publicPlan } = await prepareLaunch(request);
    assertManagedPlaybackSequence(managedSequence);
    if (launch.plan.requiresVideoTranscodeConfirmation && !request.videoTranscodeApproved) {
      return { status: "confirmation-required", plan: publicPlan };
    }
    const nonce = launch.nonce;
    prunePendingLaunches();
    const pending = {
      launch,
      createdAt: Date.now(),
      generation: connectionGeneration,
      managed: !request.openInNewWindow,
      createdPlayer: false
    };
    if (managedSequence !== void 0) pending.managedSequence = managedSequence;
    registerPendingLaunch(nonce, pending);
    if (!request.openInNewWindow && managedPlayerId !== void 0) {
      pending.playerId = managedPlayerId;
      try {
        api.global.postMessage(managedPlayerId, PLAYER_MESSAGES.replace, { nonce });
      } catch (error) {
        pendingLaunches.delete(nonce);
        throw error;
      }
    } else {
      const label = request.openInNewWindow ? `jellyfin-player-${nonce}` : MANAGED_PLAYER_LABEL;
      let playerId;
      try {
        playerId = api.global.createPlayerInstance({
          label,
          url: `${PLUGIN_PLAYBACK_SCHEME}//play/${encodeURIComponent(nonce)}`,
          enablePlugins: false
        });
      } catch (error) {
        pendingLaunches.delete(nonce);
        throw error;
      }
      pending.playerId = playerId;
      pending.createdPlayer = true;
      createdPlayerIds.add(playerId);
      if (!request.openInNewWindow) {
        managedPlayerId = playerId;
        managedPlayerReference = void 0;
      }
    }
    return { status: "started", plan: publicPlan };
  }
  async function handleBridgeRequest(raw) {
    let request;
    try {
      request = BridgeRequestSchema.parse(raw);
    } catch {
      const operation = "catalog.refresh";
      respondError(
        { operation, requestId: createOpaqueId("invalid") },
        {
          code: "INVALID_BRIDGE_MESSAGE",
          message: "The catalog sent an invalid request."
        }
      );
      return;
    }
    try {
      switch (request.operation) {
        case "connection.probe": {
          const result = await client.probe(
            request.payload.serverUrl,
            request.payload.allowInsecureRemote
          );
          respond(request, {
            server: result.server,
            normalizedUrl: result.address.url,
            transportPolicy: result.address.policy,
            isLocal: result.address.isLocal
          });
          return;
        }
        case "connection.login.password": {
          const generation = beginAuthenticationAttempt();
          const authenticated = await client.loginWithPassword(request.payload);
          assertConnectionGeneration(generation);
          connectionStore.save(authenticated.metadata, authenticated.accessToken);
          respond(request, { connection: publicConnection2(authenticated.metadata) });
          return;
        }
        case "connection.quickConnect.start": {
          const generation = beginAuthenticationAttempt();
          const attempt = await client.startQuickConnect(request.payload);
          assertConnectionGeneration(generation);
          quickConnectAttempt = attempt;
          quickConnectGeneration = generation;
          respond(request, {
            code: attempt.code,
            serverName: attempt.server.ServerName,
            expiresInSeconds: 600
          });
          return;
        }
        case "connection.quickConnect.poll": {
          if (quickConnectAttempt === void 0) throw new Error("Start Quick Connect first.");
          const attempt = quickConnectAttempt;
          const generation = quickConnectGeneration;
          const result = await client.pollQuickConnect(attempt);
          assertConnectionGeneration(generation);
          if (quickConnectAttempt !== attempt) throw staleRequest();
          if (!result.authenticated) {
            respond(request, { authenticated: false });
            return;
          }
          connectionStore.save(result.metadata, result.accessToken);
          quickConnectAttempt = void 0;
          respond(request, {
            authenticated: true,
            connection: publicConnection2(result.metadata)
          });
          return;
        }
        case "connection.disconnect":
          connectionGeneration += 1;
          connectionStore.clear();
          quickConnectAttempt = void 0;
          quickConnectGeneration = connectionGeneration;
          pendingLaunches.clear();
          pendingCatalogConfirmation = void 0;
          completedGenerations.clear();
          stopAndForgetPlayers("closed");
          respond(request, { disconnected: true });
          return;
        case "catalog.query": {
          const generation = connectionGeneration;
          const result = await client.queryCatalog(request.payload, authenticatedContext());
          assertConnectionGeneration(generation);
          respond(request, result);
          return;
        }
        case "artwork.fetch": {
          const generation = connectionGeneration;
          const dataUrl = await artworkCache.fetchDataUrl(request.payload, authenticatedContext());
          assertConnectionGeneration(generation);
          respond(request, {
            dataUrl
          });
          return;
        }
        case "playback.start":
          respond(request, await launchPlayback(request.payload));
          return;
        case "playback.stop":
          managedPlaybackSequence += 1;
          prunePendingLaunches();
          if (managedPlayerId !== void 0) {
            api.global.postMessage(managedPlayerId, PLAYER_MESSAGES.stop, {
              reason: request.payload.reason
            });
          }
          respond(request, { stopped: true });
          return;
        case "catalog.refresh":
          respond(request, {
            connection: publicConnection2(connectionStore.readMetadata()),
            refreshedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          return;
      }
    } catch (error) {
      logger.warn(`Bridge operation ${request.operation} failed`, error);
      respondError(request, error);
    }
  }
  var PLAYER_STATUSES = /* @__PURE__ */ new Set(["idle", "preparing", "playing", "paused", "stopped", "error"]);
  function parsePublicPlayerState(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return void 0;
    const candidate = raw;
    if (typeof candidate.generation !== "number" || !Number.isInteger(candidate.generation) || candidate.generation < 0 || typeof candidate.status !== "string" || !PLAYER_STATUSES.has(candidate.status)) {
      return void 0;
    }
    const state = {
      generation: candidate.generation,
      status: candidate.status
    };
    if (typeof candidate.itemId === "string" && candidate.itemId.length >= 1 && candidate.itemId.length <= 512) {
      state.itemId = candidate.itemId;
    }
    if (typeof candidate.stopReason === "string" && candidate.stopReason.length <= 64) {
      state.stopReason = candidate.stopReason;
    }
    return state;
  }
  function publicCatalogState(state) {
    const result = {
      generation: state.generation,
      status: state.status
    };
    if (state.itemId !== void 0) result.itemId = state.itemId;
    if (state.stopReason !== void 0) result.stopReason = state.stopReason;
    return result;
  }
  async function sendSeriesCorrectUpNext(player, generation, completedItemId) {
    const requestConnectionGeneration = connectionGeneration;
    const context = authenticatedContext();
    const completedItem = BaseItemSchema.parse(
      await client.queryCatalog({ kind: "details", itemId: completedItemId }, context)
    );
    assertConnectionGeneration(requestConnectionGeneration);
    if (completedItem.Type !== "Episode" || completedItem.SeriesId == null) return;
    const nextUp = ItemsResultSchema.parse(
      await client.queryCatalog(
        {
          kind: "home",
          shelf: "nextUp",
          limit: 1,
          seriesId: completedItem.SeriesId
        },
        context
      )
    );
    assertConnectionGeneration(requestConnectionGeneration);
    const next = nextUp.Items.find(
      (item) => item.SeriesId === completedItem.SeriesId && item.Id !== completedItem.Id
    );
    if (next === void 0) return;
    const currentState = catalogPlaybackStates.get(player);
    const completionKey = `${player}:${generation}`;
    if (currentState?.generation !== generation || !currentState.terminal || !completedGenerations.has(completionKey) || !playerReferences.has(player)) {
      return;
    }
    api.global.postMessage(player, PLAYER_MESSAGES.upNext, {
      item: next,
      countdownSeconds: 10,
      autoplay: api.preferences.get("autoplayNextEpisode") !== false
    });
  }
  function openCatalog() {
    api.standaloneWindow.open();
    setTimeout(() => {
      api.standaloneWindow.postMessage("catalog.visible", {
        connection: publicConnection2(connectionStore.readMetadata())
      });
      const confirmation = pendingCatalogConfirmation;
      if (confirmation === void 0) return;
      if (confirmation.connectionGeneration !== connectionGeneration || confirmation.managedSequence !== void 0 && confirmation.managedSequence !== managedPlaybackSequence) {
        pendingCatalogConfirmation = void 0;
        return;
      }
      api.standaloneWindow.postMessage("playback.confirmation-required", {
        itemId: confirmation.itemId,
        plan: confirmation.plan,
        source: "up-next",
        openInNewWindow: confirmation.openInNewWindow
      });
    }, 50);
  }
  api.standaloneWindow.loadFile("dist/ui/catalog/index.html");
  api.standaloneWindow.setProperty({
    title: "Jellyfin for IINA",
    resizable: true,
    fullSizeContentView: true,
    hideTitleBar: false
  });
  api.standaloneWindow.setFrame(1200, 820, null, null);
  api.standaloneWindow.onMessage(BRIDGE_REQUEST_MESSAGE, (data) => {
    void handleBridgeRequest(data);
  });
  api.menu.addItem(api.menu.item("Open Jellyfin Library", openCatalog));
  api.global.onMessage(PLAYER_MESSAGES.planRequest, (data, player) => {
    const record = data;
    if (typeof record.nonce !== "string" || player === void 0) return;
    prunePendingLaunches();
    const pending = pendingLaunches.get(record.nonce);
    if (pending === void 0 || pending.generation !== connectionGeneration || pending.managed && pending.managedSequence !== managedPlaybackSequence) {
      pendingLaunches.delete(record.nonce);
      return;
    }
    playerReferences.add(player);
    if (pending.playerId !== void 0) playerIdByReference.set(player, pending.playerId);
    if (pending.managed) managedPlayerReference = player;
    api.global.postMessage(player, PLAYER_MESSAGES.plan, pending.launch);
    pendingLaunches.delete(record.nonce);
  });
  api.global.onMessage(PLAYER_MESSAGES.closed, (data, player) => {
    if (player !== void 0) {
      const playerId = playerIdByReference.get(player);
      const catalogState = catalogPlaybackStates.get(player);
      const reportedGeneration = data.generation;
      const generation = typeof reportedGeneration === "number" && Number.isInteger(reportedGeneration) && reportedGeneration >= 0 ? reportedGeneration : catalogState?.generation;
      if (generation !== void 0) {
        closedGenerations.add(`${player}:${generation}`);
        if (catalogState?.started === true && !catalogState.terminal) {
          invalidateCatalogOnce(player, generation, "ended", "player-closed", {
            generation,
            status: "stopped",
            stopReason: "closed"
          });
        }
      }
      catalogPlaybackStates.delete(player);
      if (playerId !== void 0) {
        discardPendingLaunchesForPlayer(playerId);
        createdPlayerIds.delete(playerId);
      }
      playerReferences.delete(player);
      playerIdByReference.delete(player);
      if (player === managedPlayerReference) {
        managedPlaybackSequence += 1;
        managedPlayerId = void 0;
        managedPlayerReference = void 0;
      }
      releasePlayerDedupeState(player);
    }
  });
  api.global.onMessage(PLAYER_MESSAGES.state, (data, player) => {
    if (player === void 0) return;
    const state = parsePublicPlayerState(data);
    if (state === void 0) return;
    const terminal = state.status === "stopped" || state.status === "error";
    const closed = closedGenerations.has(`${player}:${state.generation}`);
    if (!playerReferences.has(player) && !closed) return;
    if (closed) {
      if (terminal) {
        invalidateCatalogOnce(
          player,
          state.generation,
          "ended",
          "playback-ended",
          publicCatalogState(state)
        );
      }
      return;
    }
    let catalogState = catalogPlaybackStates.get(player);
    if (catalogState === void 0 || catalogState.generation !== state.generation) {
      catalogState = {
        generation: state.generation,
        started: false,
        terminal: false
      };
      catalogPlaybackStates.set(player, catalogState);
    }
    if (state.itemId !== void 0) catalogState.itemId = state.itemId;
    if (state.status === "playing") {
      catalogState.started = true;
      invalidateCatalogOnce(
        player,
        state.generation,
        "started",
        "playback-started",
        publicCatalogState(state)
      );
    }
    if (terminal) {
      catalogState.terminal = true;
      invalidateCatalogOnce(
        player,
        state.generation,
        "ended",
        "playback-ended",
        publicCatalogState(state)
      );
    }
    if (state.stopReason !== "completed" || catalogState.itemId === void 0) return;
    const completionKey = `${player}:${state.generation}`;
    if (completedGenerations.has(completionKey)) return;
    completedGenerations.add(completionKey);
    void sendSeriesCorrectUpNext(player, state.generation, catalogState.itemId).catch(
      (error) => logger.warn("Could not prepare Up Next", error)
    );
  });
  api.global.onMessage(PLAYER_MESSAGES.playNext, (data, player) => {
    const itemId = data.itemId;
    if (player === void 0 || typeof itemId !== "string") return;
    void (async () => {
      const managed = player === managedPlayerReference;
      const managedSequence = managed ? ++managedPlaybackSequence : void 0;
      try {
        const request = PlaybackRequestSchema.parse({ itemId });
        const { launch, publicPlan } = await prepareLaunch(request);
        assertManagedPlaybackSequence(managedSequence);
        pendingCatalogConfirmation = void 0;
        if (launch.plan.requiresVideoTranscodeConfirmation) {
          pendingCatalogConfirmation = {
            itemId,
            plan: publicPlan,
            openInNewWindow: !managed,
            connectionGeneration
          };
          if (managedSequence !== void 0) {
            pendingCatalogConfirmation.managedSequence = managedSequence;
          }
          openCatalog();
          return;
        }
        prunePendingLaunches();
        const pending = {
          launch,
          createdAt: Date.now(),
          generation: connectionGeneration,
          managed,
          createdPlayer: false
        };
        if (managedSequence !== void 0) pending.managedSequence = managedSequence;
        const playerId = playerIdByReference.get(player);
        if (playerId !== void 0) pending.playerId = playerId;
        registerPendingLaunch(launch.nonce, pending);
        try {
          api.global.postMessage(player, PLAYER_MESSAGES.replace, { nonce: launch.nonce });
        } catch (error) {
          pendingLaunches.delete(launch.nonce);
          throw error;
        }
      } catch (error) {
        logger.warn("Could not start Up Next", error);
      }
    })();
  });
  api.global.onMessage(PLAYER_MESSAGES.catalogOpen, () => openCatalog());
  logger.info("Global Jellyfin integration ready");
})();
//# sourceMappingURL=global.js.map
