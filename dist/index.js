"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/.pnpm/uri-js@4.4.1/node_modules/uri-js/dist/es5/uri.all.js
  var require_uri_all = __commonJS({
    "node_modules/.pnpm/uri-js@4.4.1/node_modules/uri-js/dist/es5/uri.all.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : factory(global.URI = global.URI || {});
      })(exports, (function(exports2) {
        "use strict";
        function merge() {
          for (var _len = arguments.length, sets = Array(_len), _key = 0; _key < _len; _key++) {
            sets[_key] = arguments[_key];
          }
          if (sets.length > 1) {
            sets[0] = sets[0].slice(0, -1);
            var xl = sets.length - 1;
            for (var x = 1; x < xl; ++x) {
              sets[x] = sets[x].slice(1, -1);
            }
            sets[xl] = sets[xl].slice(1);
            return sets.join("");
          } else {
            return sets[0];
          }
        }
        function subexp(str) {
          return "(?:" + str + ")";
        }
        function typeOf(o) {
          return o === void 0 ? "undefined" : o === null ? "null" : Object.prototype.toString.call(o).split(" ").pop().split("]").shift().toLowerCase();
        }
        function toUpperCase(str) {
          return str.toUpperCase();
        }
        function toArray(obj) {
          return obj !== void 0 && obj !== null ? obj instanceof Array ? obj : typeof obj.length !== "number" || obj.split || obj.setInterval || obj.call ? [obj] : Array.prototype.slice.call(obj) : [];
        }
        function assign(target, source) {
          var obj = target;
          if (source) {
            for (var key in source) {
              obj[key] = source[key];
            }
          }
          return obj;
        }
        function buildExps(isIRI2) {
          var ALPHA$$ = "[A-Za-z]", CR$ = "[\\x0D]", DIGIT$$ = "[0-9]", DQUOTE$$ = "[\\x22]", HEXDIG$$2 = merge(DIGIT$$, "[A-Fa-f]"), LF$$ = "[\\x0A]", SP$$ = "[\\x20]", PCT_ENCODED$2 = subexp(subexp("%[EFef]" + HEXDIG$$2 + "%" + HEXDIG$$2 + HEXDIG$$2 + "%" + HEXDIG$$2 + HEXDIG$$2) + "|" + subexp("%[89A-Fa-f]" + HEXDIG$$2 + "%" + HEXDIG$$2 + HEXDIG$$2) + "|" + subexp("%" + HEXDIG$$2 + HEXDIG$$2)), GEN_DELIMS$$ = "[\\:\\/\\?\\#\\[\\]\\@]", SUB_DELIMS$$ = "[\\!\\$\\&\\'\\(\\)\\*\\+\\,\\;\\=]", RESERVED$$ = merge(GEN_DELIMS$$, SUB_DELIMS$$), UCSCHAR$$ = isIRI2 ? "[\\xA0-\\u200D\\u2010-\\u2029\\u202F-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF]" : "[]", IPRIVATE$$ = isIRI2 ? "[\\uE000-\\uF8FF]" : "[]", UNRESERVED$$2 = merge(ALPHA$$, DIGIT$$, "[\\-\\.\\_\\~]", UCSCHAR$$), SCHEME$ = subexp(ALPHA$$ + merge(ALPHA$$, DIGIT$$, "[\\+\\-\\.]") + "*"), USERINFO$ = subexp(subexp(PCT_ENCODED$2 + "|" + merge(UNRESERVED$$2, SUB_DELIMS$$, "[\\:]")) + "*"), DEC_OCTET$ = subexp(subexp("25[0-5]") + "|" + subexp("2[0-4]" + DIGIT$$) + "|" + subexp("1" + DIGIT$$ + DIGIT$$) + "|" + subexp("[1-9]" + DIGIT$$) + "|" + DIGIT$$), DEC_OCTET_RELAXED$ = subexp(subexp("25[0-5]") + "|" + subexp("2[0-4]" + DIGIT$$) + "|" + subexp("1" + DIGIT$$ + DIGIT$$) + "|" + subexp("0?[1-9]" + DIGIT$$) + "|0?0?" + DIGIT$$), IPV4ADDRESS$ = subexp(DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$), H16$ = subexp(HEXDIG$$2 + "{1,4}"), LS32$ = subexp(subexp(H16$ + "\\:" + H16$) + "|" + IPV4ADDRESS$), IPV6ADDRESS1$ = subexp(subexp(H16$ + "\\:") + "{6}" + LS32$), IPV6ADDRESS2$ = subexp("\\:\\:" + subexp(H16$ + "\\:") + "{5}" + LS32$), IPV6ADDRESS3$ = subexp(subexp(H16$) + "?\\:\\:" + subexp(H16$ + "\\:") + "{4}" + LS32$), IPV6ADDRESS4$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,1}" + H16$) + "?\\:\\:" + subexp(H16$ + "\\:") + "{3}" + LS32$), IPV6ADDRESS5$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,2}" + H16$) + "?\\:\\:" + subexp(H16$ + "\\:") + "{2}" + LS32$), IPV6ADDRESS6$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,3}" + H16$) + "?\\:\\:" + H16$ + "\\:" + LS32$), IPV6ADDRESS7$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,4}" + H16$) + "?\\:\\:" + LS32$), IPV6ADDRESS8$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,5}" + H16$) + "?\\:\\:" + H16$), IPV6ADDRESS9$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,6}" + H16$) + "?\\:\\:"), IPV6ADDRESS$ = subexp([IPV6ADDRESS1$, IPV6ADDRESS2$, IPV6ADDRESS3$, IPV6ADDRESS4$, IPV6ADDRESS5$, IPV6ADDRESS6$, IPV6ADDRESS7$, IPV6ADDRESS8$, IPV6ADDRESS9$].join("|")), ZONEID$ = subexp(subexp(UNRESERVED$$2 + "|" + PCT_ENCODED$2) + "+"), IPV6ADDRZ$ = subexp(IPV6ADDRESS$ + "\\%25" + ZONEID$), IPV6ADDRZ_RELAXED$ = subexp(IPV6ADDRESS$ + subexp("\\%25|\\%(?!" + HEXDIG$$2 + "{2})") + ZONEID$), IPVFUTURE$ = subexp("[vV]" + HEXDIG$$2 + "+\\." + merge(UNRESERVED$$2, SUB_DELIMS$$, "[\\:]") + "+"), IP_LITERAL$ = subexp("\\[" + subexp(IPV6ADDRZ_RELAXED$ + "|" + IPV6ADDRESS$ + "|" + IPVFUTURE$) + "\\]"), REG_NAME$ = subexp(subexp(PCT_ENCODED$2 + "|" + merge(UNRESERVED$$2, SUB_DELIMS$$)) + "*"), HOST$ = subexp(IP_LITERAL$ + "|" + IPV4ADDRESS$ + "(?!" + REG_NAME$ + ")|" + REG_NAME$), PORT$ = subexp(DIGIT$$ + "*"), AUTHORITY$ = subexp(subexp(USERINFO$ + "@") + "?" + HOST$ + subexp("\\:" + PORT$) + "?"), PCHAR$ = subexp(PCT_ENCODED$2 + "|" + merge(UNRESERVED$$2, SUB_DELIMS$$, "[\\:\\@]")), SEGMENT$ = subexp(PCHAR$ + "*"), SEGMENT_NZ$ = subexp(PCHAR$ + "+"), SEGMENT_NZ_NC$ = subexp(subexp(PCT_ENCODED$2 + "|" + merge(UNRESERVED$$2, SUB_DELIMS$$, "[\\@]")) + "+"), PATH_ABEMPTY$ = subexp(subexp("\\/" + SEGMENT$) + "*"), PATH_ABSOLUTE$ = subexp("\\/" + subexp(SEGMENT_NZ$ + PATH_ABEMPTY$) + "?"), PATH_NOSCHEME$ = subexp(SEGMENT_NZ_NC$ + PATH_ABEMPTY$), PATH_ROOTLESS$ = subexp(SEGMENT_NZ$ + PATH_ABEMPTY$), PATH_EMPTY$ = "(?!" + PCHAR$ + ")", PATH$ = subexp(PATH_ABEMPTY$ + "|" + PATH_ABSOLUTE$ + "|" + PATH_NOSCHEME$ + "|" + PATH_ROOTLESS$ + "|" + PATH_EMPTY$), QUERY$ = subexp(subexp(PCHAR$ + "|" + merge("[\\/\\?]", IPRIVATE$$)) + "*"), FRAGMENT$ = subexp(subexp(PCHAR$ + "|[\\/\\?]") + "*"), HIER_PART$ = subexp(subexp("\\/\\/" + AUTHORITY$ + PATH_ABEMPTY$) + "|" + PATH_ABSOLUTE$ + "|" + PATH_ROOTLESS$ + "|" + PATH_EMPTY$), URI$ = subexp(SCHEME$ + "\\:" + HIER_PART$ + subexp("\\?" + QUERY$) + "?" + subexp("\\#" + FRAGMENT$) + "?"), RELATIVE_PART$ = subexp(subexp("\\/\\/" + AUTHORITY$ + PATH_ABEMPTY$) + "|" + PATH_ABSOLUTE$ + "|" + PATH_NOSCHEME$ + "|" + PATH_EMPTY$), RELATIVE$ = subexp(RELATIVE_PART$ + subexp("\\?" + QUERY$) + "?" + subexp("\\#" + FRAGMENT$) + "?"), URI_REFERENCE$ = subexp(URI$ + "|" + RELATIVE$), ABSOLUTE_URI$ = subexp(SCHEME$ + "\\:" + HIER_PART$ + subexp("\\?" + QUERY$) + "?"), GENERIC_REF$ = "^(" + SCHEME$ + ")\\:" + subexp(subexp("\\/\\/(" + subexp("(" + USERINFO$ + ")@") + "?(" + HOST$ + ")" + subexp("\\:(" + PORT$ + ")") + "?)") + "?(" + PATH_ABEMPTY$ + "|" + PATH_ABSOLUTE$ + "|" + PATH_ROOTLESS$ + "|" + PATH_EMPTY$ + ")") + subexp("\\?(" + QUERY$ + ")") + "?" + subexp("\\#(" + FRAGMENT$ + ")") + "?$", RELATIVE_REF$ = "^(){0}" + subexp(subexp("\\/\\/(" + subexp("(" + USERINFO$ + ")@") + "?(" + HOST$ + ")" + subexp("\\:(" + PORT$ + ")") + "?)") + "?(" + PATH_ABEMPTY$ + "|" + PATH_ABSOLUTE$ + "|" + PATH_NOSCHEME$ + "|" + PATH_EMPTY$ + ")") + subexp("\\?(" + QUERY$ + ")") + "?" + subexp("\\#(" + FRAGMENT$ + ")") + "?$", ABSOLUTE_REF$ = "^(" + SCHEME$ + ")\\:" + subexp(subexp("\\/\\/(" + subexp("(" + USERINFO$ + ")@") + "?(" + HOST$ + ")" + subexp("\\:(" + PORT$ + ")") + "?)") + "?(" + PATH_ABEMPTY$ + "|" + PATH_ABSOLUTE$ + "|" + PATH_ROOTLESS$ + "|" + PATH_EMPTY$ + ")") + subexp("\\?(" + QUERY$ + ")") + "?$", SAMEDOC_REF$ = "^" + subexp("\\#(" + FRAGMENT$ + ")") + "?$", AUTHORITY_REF$ = "^" + subexp("(" + USERINFO$ + ")@") + "?(" + HOST$ + ")" + subexp("\\:(" + PORT$ + ")") + "?$";
          return {
            NOT_SCHEME: new RegExp(merge("[^]", ALPHA$$, DIGIT$$, "[\\+\\-\\.]"), "g"),
            NOT_USERINFO: new RegExp(merge("[^\\%\\:]", UNRESERVED$$2, SUB_DELIMS$$), "g"),
            NOT_HOST: new RegExp(merge("[^\\%\\[\\]\\:]", UNRESERVED$$2, SUB_DELIMS$$), "g"),
            NOT_PATH: new RegExp(merge("[^\\%\\/\\:\\@]", UNRESERVED$$2, SUB_DELIMS$$), "g"),
            NOT_PATH_NOSCHEME: new RegExp(merge("[^\\%\\/\\@]", UNRESERVED$$2, SUB_DELIMS$$), "g"),
            NOT_QUERY: new RegExp(merge("[^\\%]", UNRESERVED$$2, SUB_DELIMS$$, "[\\:\\@\\/\\?]", IPRIVATE$$), "g"),
            NOT_FRAGMENT: new RegExp(merge("[^\\%]", UNRESERVED$$2, SUB_DELIMS$$, "[\\:\\@\\/\\?]"), "g"),
            ESCAPE: new RegExp(merge("[^]", UNRESERVED$$2, SUB_DELIMS$$), "g"),
            UNRESERVED: new RegExp(UNRESERVED$$2, "g"),
            OTHER_CHARS: new RegExp(merge("[^\\%]", UNRESERVED$$2, RESERVED$$), "g"),
            PCT_ENCODED: new RegExp(PCT_ENCODED$2, "g"),
            IPV4ADDRESS: new RegExp("^(" + IPV4ADDRESS$ + ")$"),
            IPV6ADDRESS: new RegExp("^\\[?(" + IPV6ADDRESS$ + ")" + subexp(subexp("\\%25|\\%(?!" + HEXDIG$$2 + "{2})") + "(" + ZONEID$ + ")") + "?\\]?$")
            //RFC 6874, with relaxed parsing rules
          };
        }
        var URI_PROTOCOL = buildExps(false);
        var IRI_PROTOCOL = buildExps(true);
        var slicedToArray = /* @__PURE__ */ (function() {
          function sliceIterator(arr, i) {
            var _arr = [];
            var _n = true;
            var _d = false;
            var _e = void 0;
            try {
              for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                _arr.push(_s.value);
                if (i && _arr.length === i) break;
              }
            } catch (err) {
              _d = true;
              _e = err;
            } finally {
              try {
                if (!_n && _i["return"]) _i["return"]();
              } finally {
                if (_d) throw _e;
              }
            }
            return _arr;
          }
          return function(arr, i) {
            if (Array.isArray(arr)) {
              return arr;
            } else if (Symbol.iterator in Object(arr)) {
              return sliceIterator(arr, i);
            } else {
              throw new TypeError("Invalid attempt to destructure non-iterable instance");
            }
          };
        })();
        var toConsumableArray = function(arr) {
          if (Array.isArray(arr)) {
            for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];
            return arr2;
          } else {
            return Array.from(arr);
          }
        };
        var maxInt = 2147483647;
        var base = 36;
        var tMin = 1;
        var tMax = 26;
        var skew = 38;
        var damp = 700;
        var initialBias = 72;
        var initialN = 128;
        var delimiter = "-";
        var regexPunycode = /^xn--/;
        var regexNonASCII = /[^\0-\x7E]/;
        var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
        var errors = {
          "overflow": "Overflow: input needs wider integers to process",
          "not-basic": "Illegal input >= 0x80 (not a basic code point)",
          "invalid-input": "Invalid input"
        };
        var baseMinusTMin = base - tMin;
        var floor = Math.floor;
        var stringFromCharCode = String.fromCharCode;
        function error$1(type) {
          throw new RangeError(errors[type]);
        }
        function map(array, fn) {
          var result = [];
          var length = array.length;
          while (length--) {
            result[length] = fn(array[length]);
          }
          return result;
        }
        function mapDomain(string, fn) {
          var parts = string.split("@");
          var result = "";
          if (parts.length > 1) {
            result = parts[0] + "@";
            string = parts[1];
          }
          string = string.replace(regexSeparators, ".");
          var labels = string.split(".");
          var encoded = map(labels, fn).join(".");
          return result + encoded;
        }
        function ucs2decode(string) {
          var output = [];
          var counter = 0;
          var length = string.length;
          while (counter < length) {
            var value = string.charCodeAt(counter++);
            if (value >= 55296 && value <= 56319 && counter < length) {
              var extra = string.charCodeAt(counter++);
              if ((extra & 64512) == 56320) {
                output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
              } else {
                output.push(value);
                counter--;
              }
            } else {
              output.push(value);
            }
          }
          return output;
        }
        var ucs2encode = function ucs2encode2(array) {
          return String.fromCodePoint.apply(String, toConsumableArray(array));
        };
        var basicToDigit = function basicToDigit2(codePoint) {
          if (codePoint - 48 < 10) {
            return codePoint - 22;
          }
          if (codePoint - 65 < 26) {
            return codePoint - 65;
          }
          if (codePoint - 97 < 26) {
            return codePoint - 97;
          }
          return base;
        };
        var digitToBasic = function digitToBasic2(digit, flag) {
          return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
        };
        var adapt = function adapt2(delta, numPoints, firstTime) {
          var k = 0;
          delta = firstTime ? floor(delta / damp) : delta >> 1;
          delta += floor(delta / numPoints);
          for (
            ;
            /* no initialization */
            delta > baseMinusTMin * tMax >> 1;
            k += base
          ) {
            delta = floor(delta / baseMinusTMin);
          }
          return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
        };
        var decode = function decode2(input) {
          var output = [];
          var inputLength = input.length;
          var i = 0;
          var n = initialN;
          var bias = initialBias;
          var basic = input.lastIndexOf(delimiter);
          if (basic < 0) {
            basic = 0;
          }
          for (var j = 0; j < basic; ++j) {
            if (input.charCodeAt(j) >= 128) {
              error$1("not-basic");
            }
            output.push(input.charCodeAt(j));
          }
          for (var index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
            var oldi = i;
            for (
              var w = 1, k = base;
              ;
              /* no condition */
              k += base
            ) {
              if (index >= inputLength) {
                error$1("invalid-input");
              }
              var digit = basicToDigit(input.charCodeAt(index++));
              if (digit >= base || digit > floor((maxInt - i) / w)) {
                error$1("overflow");
              }
              i += digit * w;
              var t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
              if (digit < t) {
                break;
              }
              var baseMinusT = base - t;
              if (w > floor(maxInt / baseMinusT)) {
                error$1("overflow");
              }
              w *= baseMinusT;
            }
            var out = output.length + 1;
            bias = adapt(i - oldi, out, oldi == 0);
            if (floor(i / out) > maxInt - n) {
              error$1("overflow");
            }
            n += floor(i / out);
            i %= out;
            output.splice(i++, 0, n);
          }
          return String.fromCodePoint.apply(String, output);
        };
        var encode = function encode2(input) {
          var output = [];
          input = ucs2decode(input);
          var inputLength = input.length;
          var n = initialN;
          var delta = 0;
          var bias = initialBias;
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = void 0;
          try {
            for (var _iterator = input[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var _currentValue2 = _step.value;
              if (_currentValue2 < 128) {
                output.push(stringFromCharCode(_currentValue2));
              }
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
          var basicLength = output.length;
          var handledCPCount = basicLength;
          if (basicLength) {
            output.push(delimiter);
          }
          while (handledCPCount < inputLength) {
            var m = maxInt;
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = void 0;
            try {
              for (var _iterator2 = input[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var currentValue = _step2.value;
                if (currentValue >= n && currentValue < m) {
                  m = currentValue;
                }
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                  _iterator2.return();
                }
              } finally {
                if (_didIteratorError2) {
                  throw _iteratorError2;
                }
              }
            }
            var handledCPCountPlusOne = handledCPCount + 1;
            if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
              error$1("overflow");
            }
            delta += (m - n) * handledCPCountPlusOne;
            n = m;
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = void 0;
            try {
              for (var _iterator3 = input[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var _currentValue = _step3.value;
                if (_currentValue < n && ++delta > maxInt) {
                  error$1("overflow");
                }
                if (_currentValue == n) {
                  var q = delta;
                  for (
                    var k = base;
                    ;
                    /* no condition */
                    k += base
                  ) {
                    var t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                    if (q < t) {
                      break;
                    }
                    var qMinusT = q - t;
                    var baseMinusT = base - t;
                    output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
                    q = floor(qMinusT / baseMinusT);
                  }
                  output.push(stringFromCharCode(digitToBasic(q, 0)));
                  bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
                  delta = 0;
                  ++handledCPCount;
                }
              }
            } catch (err) {
              _didIteratorError3 = true;
              _iteratorError3 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                  _iterator3.return();
                }
              } finally {
                if (_didIteratorError3) {
                  throw _iteratorError3;
                }
              }
            }
            ++delta;
            ++n;
          }
          return output.join("");
        };
        var toUnicode = function toUnicode2(input) {
          return mapDomain(input, function(string) {
            return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
          });
        };
        var toASCII = function toASCII2(input) {
          return mapDomain(input, function(string) {
            return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
          });
        };
        var punycode = {
          /**
           * A string representing the current Punycode.js version number.
           * @memberOf punycode
           * @type String
           */
          "version": "2.1.0",
          /**
           * An object of methods to convert from JavaScript's internal character
           * representation (UCS-2) to Unicode code points, and back.
           * @see <https://mathiasbynens.be/notes/javascript-encoding>
           * @memberOf punycode
           * @type Object
           */
          "ucs2": {
            "decode": ucs2decode,
            "encode": ucs2encode
          },
          "decode": decode,
          "encode": encode,
          "toASCII": toASCII,
          "toUnicode": toUnicode
        };
        var SCHEMES = {};
        function pctEncChar(chr) {
          var c = chr.charCodeAt(0);
          var e = void 0;
          if (c < 16) e = "%0" + c.toString(16).toUpperCase();
          else if (c < 128) e = "%" + c.toString(16).toUpperCase();
          else if (c < 2048) e = "%" + (c >> 6 | 192).toString(16).toUpperCase() + "%" + (c & 63 | 128).toString(16).toUpperCase();
          else e = "%" + (c >> 12 | 224).toString(16).toUpperCase() + "%" + (c >> 6 & 63 | 128).toString(16).toUpperCase() + "%" + (c & 63 | 128).toString(16).toUpperCase();
          return e;
        }
        function pctDecChars(str) {
          var newStr = "";
          var i = 0;
          var il = str.length;
          while (i < il) {
            var c = parseInt(str.substr(i + 1, 2), 16);
            if (c < 128) {
              newStr += String.fromCharCode(c);
              i += 3;
            } else if (c >= 194 && c < 224) {
              if (il - i >= 6) {
                var c2 = parseInt(str.substr(i + 4, 2), 16);
                newStr += String.fromCharCode((c & 31) << 6 | c2 & 63);
              } else {
                newStr += str.substr(i, 6);
              }
              i += 6;
            } else if (c >= 224) {
              if (il - i >= 9) {
                var _c = parseInt(str.substr(i + 4, 2), 16);
                var c3 = parseInt(str.substr(i + 7, 2), 16);
                newStr += String.fromCharCode((c & 15) << 12 | (_c & 63) << 6 | c3 & 63);
              } else {
                newStr += str.substr(i, 9);
              }
              i += 9;
            } else {
              newStr += str.substr(i, 3);
              i += 3;
            }
          }
          return newStr;
        }
        function _normalizeComponentEncoding(components, protocol) {
          function decodeUnreserved2(str) {
            var decStr = pctDecChars(str);
            return !decStr.match(protocol.UNRESERVED) ? str : decStr;
          }
          if (components.scheme) components.scheme = String(components.scheme).replace(protocol.PCT_ENCODED, decodeUnreserved2).toLowerCase().replace(protocol.NOT_SCHEME, "");
          if (components.userinfo !== void 0) components.userinfo = String(components.userinfo).replace(protocol.PCT_ENCODED, decodeUnreserved2).replace(protocol.NOT_USERINFO, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
          if (components.host !== void 0) components.host = String(components.host).replace(protocol.PCT_ENCODED, decodeUnreserved2).toLowerCase().replace(protocol.NOT_HOST, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
          if (components.path !== void 0) components.path = String(components.path).replace(protocol.PCT_ENCODED, decodeUnreserved2).replace(components.scheme ? protocol.NOT_PATH : protocol.NOT_PATH_NOSCHEME, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
          if (components.query !== void 0) components.query = String(components.query).replace(protocol.PCT_ENCODED, decodeUnreserved2).replace(protocol.NOT_QUERY, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
          if (components.fragment !== void 0) components.fragment = String(components.fragment).replace(protocol.PCT_ENCODED, decodeUnreserved2).replace(protocol.NOT_FRAGMENT, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
          return components;
        }
        function _stripLeadingZeros(str) {
          return str.replace(/^0*(.*)/, "$1") || "0";
        }
        function _normalizeIPv4(host, protocol) {
          var matches = host.match(protocol.IPV4ADDRESS) || [];
          var _matches = slicedToArray(matches, 2), address = _matches[1];
          if (address) {
            return address.split(".").map(_stripLeadingZeros).join(".");
          } else {
            return host;
          }
        }
        function _normalizeIPv6(host, protocol) {
          var matches = host.match(protocol.IPV6ADDRESS) || [];
          var _matches2 = slicedToArray(matches, 3), address = _matches2[1], zone = _matches2[2];
          if (address) {
            var _address$toLowerCase$ = address.toLowerCase().split("::").reverse(), _address$toLowerCase$2 = slicedToArray(_address$toLowerCase$, 2), last = _address$toLowerCase$2[0], first = _address$toLowerCase$2[1];
            var firstFields = first ? first.split(":").map(_stripLeadingZeros) : [];
            var lastFields = last.split(":").map(_stripLeadingZeros);
            var isLastFieldIPv4Address = protocol.IPV4ADDRESS.test(lastFields[lastFields.length - 1]);
            var fieldCount = isLastFieldIPv4Address ? 7 : 8;
            var lastFieldsStart = lastFields.length - fieldCount;
            var fields = Array(fieldCount);
            for (var x = 0; x < fieldCount; ++x) {
              fields[x] = firstFields[x] || lastFields[lastFieldsStart + x] || "";
            }
            if (isLastFieldIPv4Address) {
              fields[fieldCount - 1] = _normalizeIPv4(fields[fieldCount - 1], protocol);
            }
            var allZeroFields = fields.reduce(function(acc, field, index) {
              if (!field || field === "0") {
                var lastLongest = acc[acc.length - 1];
                if (lastLongest && lastLongest.index + lastLongest.length === index) {
                  lastLongest.length++;
                } else {
                  acc.push({ index, length: 1 });
                }
              }
              return acc;
            }, []);
            var longestZeroFields = allZeroFields.sort(function(a, b) {
              return b.length - a.length;
            })[0];
            var newHost = void 0;
            if (longestZeroFields && longestZeroFields.length > 1) {
              var newFirst = fields.slice(0, longestZeroFields.index);
              var newLast = fields.slice(longestZeroFields.index + longestZeroFields.length);
              newHost = newFirst.join(":") + "::" + newLast.join(":");
            } else {
              newHost = fields.join(":");
            }
            if (zone) {
              newHost += "%" + zone;
            }
            return newHost;
          } else {
            return host;
          }
        }
        var URI_PARSE = /^(?:([^:\/?#]+):)?(?:\/\/((?:([^\/?#@]*)@)?(\[[^\/?#\]]+\]|[^\/?#:]*)(?:\:(\d*))?))?([^?#]*)(?:\?([^#]*))?(?:#((?:.|\n|\r)*))?/i;
        var NO_MATCH_IS_UNDEFINED = "".match(/(){0}/)[1] === void 0;
        function parse(uriString) {
          var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
          var components = {};
          var protocol = options.iri !== false ? IRI_PROTOCOL : URI_PROTOCOL;
          if (options.reference === "suffix") uriString = (options.scheme ? options.scheme + ":" : "") + "//" + uriString;
          var matches = uriString.match(URI_PARSE);
          if (matches) {
            if (NO_MATCH_IS_UNDEFINED) {
              components.scheme = matches[1];
              components.userinfo = matches[3];
              components.host = matches[4];
              components.port = parseInt(matches[5], 10);
              components.path = matches[6] || "";
              components.query = matches[7];
              components.fragment = matches[8];
              if (isNaN(components.port)) {
                components.port = matches[5];
              }
            } else {
              components.scheme = matches[1] || void 0;
              components.userinfo = uriString.indexOf("@") !== -1 ? matches[3] : void 0;
              components.host = uriString.indexOf("//") !== -1 ? matches[4] : void 0;
              components.port = parseInt(matches[5], 10);
              components.path = matches[6] || "";
              components.query = uriString.indexOf("?") !== -1 ? matches[7] : void 0;
              components.fragment = uriString.indexOf("#") !== -1 ? matches[8] : void 0;
              if (isNaN(components.port)) {
                components.port = uriString.match(/\/\/(?:.|\n)*\:(?:\/|\?|\#|$)/) ? matches[4] : void 0;
              }
            }
            if (components.host) {
              components.host = _normalizeIPv6(_normalizeIPv4(components.host, protocol), protocol);
            }
            if (components.scheme === void 0 && components.userinfo === void 0 && components.host === void 0 && components.port === void 0 && !components.path && components.query === void 0) {
              components.reference = "same-document";
            } else if (components.scheme === void 0) {
              components.reference = "relative";
            } else if (components.fragment === void 0) {
              components.reference = "absolute";
            } else {
              components.reference = "uri";
            }
            if (options.reference && options.reference !== "suffix" && options.reference !== components.reference) {
              components.error = components.error || "URI is not a " + options.reference + " reference.";
            }
            var schemeHandler = SCHEMES[(options.scheme || components.scheme || "").toLowerCase()];
            if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
              if (components.host && (options.domainHost || schemeHandler && schemeHandler.domainHost)) {
                try {
                  components.host = punycode.toASCII(components.host.replace(protocol.PCT_ENCODED, pctDecChars).toLowerCase());
                } catch (e) {
                  components.error = components.error || "Host's domain name can not be converted to ASCII via punycode: " + e;
                }
              }
              _normalizeComponentEncoding(components, URI_PROTOCOL);
            } else {
              _normalizeComponentEncoding(components, protocol);
            }
            if (schemeHandler && schemeHandler.parse) {
              schemeHandler.parse(components, options);
            }
          } else {
            components.error = components.error || "URI can not be parsed.";
          }
          return components;
        }
        function _recomposeAuthority(components, options) {
          var protocol = options.iri !== false ? IRI_PROTOCOL : URI_PROTOCOL;
          var uriTokens = [];
          if (components.userinfo !== void 0) {
            uriTokens.push(components.userinfo);
            uriTokens.push("@");
          }
          if (components.host !== void 0) {
            uriTokens.push(_normalizeIPv6(_normalizeIPv4(String(components.host), protocol), protocol).replace(protocol.IPV6ADDRESS, function(_, $1, $2) {
              return "[" + $1 + ($2 ? "%25" + $2 : "") + "]";
            }));
          }
          if (typeof components.port === "number" || typeof components.port === "string") {
            uriTokens.push(":");
            uriTokens.push(String(components.port));
          }
          return uriTokens.length ? uriTokens.join("") : void 0;
        }
        var RDS1 = /^\.\.?\//;
        var RDS2 = /^\/\.(\/|$)/;
        var RDS3 = /^\/\.\.(\/|$)/;
        var RDS5 = /^\/?(?:.|\n)*?(?=\/|$)/;
        function removeDotSegments(input) {
          var output = [];
          while (input.length) {
            if (input.match(RDS1)) {
              input = input.replace(RDS1, "");
            } else if (input.match(RDS2)) {
              input = input.replace(RDS2, "/");
            } else if (input.match(RDS3)) {
              input = input.replace(RDS3, "/");
              output.pop();
            } else if (input === "." || input === "..") {
              input = "";
            } else {
              var im = input.match(RDS5);
              if (im) {
                var s = im[0];
                input = input.slice(s.length);
                output.push(s);
              } else {
                throw new Error("Unexpected dot segment condition");
              }
            }
          }
          return output.join("");
        }
        function serialize2(components) {
          var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
          var protocol = options.iri ? IRI_PROTOCOL : URI_PROTOCOL;
          var uriTokens = [];
          var schemeHandler = SCHEMES[(options.scheme || components.scheme || "").toLowerCase()];
          if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(components, options);
          if (components.host) {
            if (protocol.IPV6ADDRESS.test(components.host)) {
            } else if (options.domainHost || schemeHandler && schemeHandler.domainHost) {
              try {
                components.host = !options.iri ? punycode.toASCII(components.host.replace(protocol.PCT_ENCODED, pctDecChars).toLowerCase()) : punycode.toUnicode(components.host);
              } catch (e) {
                components.error = components.error || "Host's domain name can not be converted to " + (!options.iri ? "ASCII" : "Unicode") + " via punycode: " + e;
              }
            }
          }
          _normalizeComponentEncoding(components, protocol);
          if (options.reference !== "suffix" && components.scheme) {
            uriTokens.push(components.scheme);
            uriTokens.push(":");
          }
          var authority = _recomposeAuthority(components, options);
          if (authority !== void 0) {
            if (options.reference !== "suffix") {
              uriTokens.push("//");
            }
            uriTokens.push(authority);
            if (components.path && components.path.charAt(0) !== "/") {
              uriTokens.push("/");
            }
          }
          if (components.path !== void 0) {
            var s = components.path;
            if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
              s = removeDotSegments(s);
            }
            if (authority === void 0) {
              s = s.replace(/^\/\//, "/%2F");
            }
            uriTokens.push(s);
          }
          if (components.query !== void 0) {
            uriTokens.push("?");
            uriTokens.push(components.query);
          }
          if (components.fragment !== void 0) {
            uriTokens.push("#");
            uriTokens.push(components.fragment);
          }
          return uriTokens.join("");
        }
        function resolveComponents(base2, relative) {
          var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
          var skipNormalization = arguments[3];
          var target = {};
          if (!skipNormalization) {
            base2 = parse(serialize2(base2, options), options);
            relative = parse(serialize2(relative, options), options);
          }
          options = options || {};
          if (!options.tolerant && relative.scheme) {
            target.scheme = relative.scheme;
            target.userinfo = relative.userinfo;
            target.host = relative.host;
            target.port = relative.port;
            target.path = removeDotSegments(relative.path || "");
            target.query = relative.query;
          } else {
            if (relative.userinfo !== void 0 || relative.host !== void 0 || relative.port !== void 0) {
              target.userinfo = relative.userinfo;
              target.host = relative.host;
              target.port = relative.port;
              target.path = removeDotSegments(relative.path || "");
              target.query = relative.query;
            } else {
              if (!relative.path) {
                target.path = base2.path;
                if (relative.query !== void 0) {
                  target.query = relative.query;
                } else {
                  target.query = base2.query;
                }
              } else {
                if (relative.path.charAt(0) === "/") {
                  target.path = removeDotSegments(relative.path);
                } else {
                  if ((base2.userinfo !== void 0 || base2.host !== void 0 || base2.port !== void 0) && !base2.path) {
                    target.path = "/" + relative.path;
                  } else if (!base2.path) {
                    target.path = relative.path;
                  } else {
                    target.path = base2.path.slice(0, base2.path.lastIndexOf("/") + 1) + relative.path;
                  }
                  target.path = removeDotSegments(target.path);
                }
                target.query = relative.query;
              }
              target.userinfo = base2.userinfo;
              target.host = base2.host;
              target.port = base2.port;
            }
            target.scheme = base2.scheme;
          }
          target.fragment = relative.fragment;
          return target;
        }
        function resolve(baseURI, relativeURI, options) {
          var schemelessOptions = assign({ scheme: "null" }, options);
          return serialize2(resolveComponents(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true), schemelessOptions);
        }
        function normalize(uri, options) {
          if (typeof uri === "string") {
            uri = serialize2(parse(uri, options), options);
          } else if (typeOf(uri) === "object") {
            uri = parse(serialize2(uri, options), options);
          }
          return uri;
        }
        function equal(uriA, uriB, options) {
          if (typeof uriA === "string") {
            uriA = serialize2(parse(uriA, options), options);
          } else if (typeOf(uriA) === "object") {
            uriA = serialize2(uriA, options);
          }
          if (typeof uriB === "string") {
            uriB = serialize2(parse(uriB, options), options);
          } else if (typeOf(uriB) === "object") {
            uriB = serialize2(uriB, options);
          }
          return uriA === uriB;
        }
        function escapeComponent(str, options) {
          return str && str.toString().replace(!options || !options.iri ? URI_PROTOCOL.ESCAPE : IRI_PROTOCOL.ESCAPE, pctEncChar);
        }
        function unescapeComponent(str, options) {
          return str && str.toString().replace(!options || !options.iri ? URI_PROTOCOL.PCT_ENCODED : IRI_PROTOCOL.PCT_ENCODED, pctDecChars);
        }
        var handler = {
          scheme: "http",
          domainHost: true,
          parse: function parse2(components, options) {
            if (!components.host) {
              components.error = components.error || "HTTP URIs must have a host.";
            }
            return components;
          },
          serialize: function serialize3(components, options) {
            var secure = String(components.scheme).toLowerCase() === "https";
            if (components.port === (secure ? 443 : 80) || components.port === "") {
              components.port = void 0;
            }
            if (!components.path) {
              components.path = "/";
            }
            return components;
          }
        };
        var handler$1 = {
          scheme: "https",
          domainHost: handler.domainHost,
          parse: handler.parse,
          serialize: handler.serialize
        };
        function isSecure(wsComponents) {
          return typeof wsComponents.secure === "boolean" ? wsComponents.secure : String(wsComponents.scheme).toLowerCase() === "wss";
        }
        var handler$2 = {
          scheme: "ws",
          domainHost: true,
          parse: function parse2(components, options) {
            var wsComponents = components;
            wsComponents.secure = isSecure(wsComponents);
            wsComponents.resourceName = (wsComponents.path || "/") + (wsComponents.query ? "?" + wsComponents.query : "");
            wsComponents.path = void 0;
            wsComponents.query = void 0;
            return wsComponents;
          },
          serialize: function serialize3(wsComponents, options) {
            if (wsComponents.port === (isSecure(wsComponents) ? 443 : 80) || wsComponents.port === "") {
              wsComponents.port = void 0;
            }
            if (typeof wsComponents.secure === "boolean") {
              wsComponents.scheme = wsComponents.secure ? "wss" : "ws";
              wsComponents.secure = void 0;
            }
            if (wsComponents.resourceName) {
              var _wsComponents$resourc = wsComponents.resourceName.split("?"), _wsComponents$resourc2 = slicedToArray(_wsComponents$resourc, 2), path = _wsComponents$resourc2[0], query = _wsComponents$resourc2[1];
              wsComponents.path = path && path !== "/" ? path : void 0;
              wsComponents.query = query;
              wsComponents.resourceName = void 0;
            }
            wsComponents.fragment = void 0;
            return wsComponents;
          }
        };
        var handler$3 = {
          scheme: "wss",
          domainHost: handler$2.domainHost,
          parse: handler$2.parse,
          serialize: handler$2.serialize
        };
        var O = {};
        var isIRI = true;
        var UNRESERVED$$ = "[A-Za-z0-9\\-\\.\\_\\~" + (isIRI ? "\\xA0-\\u200D\\u2010-\\u2029\\u202F-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF" : "") + "]";
        var HEXDIG$$ = "[0-9A-Fa-f]";
        var PCT_ENCODED$ = subexp(subexp("%[EFef]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$) + "|" + subexp("%[89A-Fa-f]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$) + "|" + subexp("%" + HEXDIG$$ + HEXDIG$$));
        var ATEXT$$ = "[A-Za-z0-9\\!\\$\\%\\'\\*\\+\\-\\^\\_\\`\\{\\|\\}\\~]";
        var QTEXT$$ = "[\\!\\$\\%\\'\\(\\)\\*\\+\\,\\-\\.0-9\\<\\>A-Z\\x5E-\\x7E]";
        var VCHAR$$ = merge(QTEXT$$, '[\\"\\\\]');
        var SOME_DELIMS$$ = "[\\!\\$\\'\\(\\)\\*\\+\\,\\;\\:\\@]";
        var UNRESERVED = new RegExp(UNRESERVED$$, "g");
        var PCT_ENCODED = new RegExp(PCT_ENCODED$, "g");
        var NOT_LOCAL_PART = new RegExp(merge("[^]", ATEXT$$, "[\\.]", '[\\"]', VCHAR$$), "g");
        var NOT_HFNAME = new RegExp(merge("[^]", UNRESERVED$$, SOME_DELIMS$$), "g");
        var NOT_HFVALUE = NOT_HFNAME;
        function decodeUnreserved(str) {
          var decStr = pctDecChars(str);
          return !decStr.match(UNRESERVED) ? str : decStr;
        }
        var handler$4 = {
          scheme: "mailto",
          parse: function parse$$1(components, options) {
            var mailtoComponents = components;
            var to = mailtoComponents.to = mailtoComponents.path ? mailtoComponents.path.split(",") : [];
            mailtoComponents.path = void 0;
            if (mailtoComponents.query) {
              var unknownHeaders = false;
              var headers = {};
              var hfields = mailtoComponents.query.split("&");
              for (var x = 0, xl = hfields.length; x < xl; ++x) {
                var hfield = hfields[x].split("=");
                switch (hfield[0]) {
                  case "to":
                    var toAddrs = hfield[1].split(",");
                    for (var _x = 0, _xl = toAddrs.length; _x < _xl; ++_x) {
                      to.push(toAddrs[_x]);
                    }
                    break;
                  case "subject":
                    mailtoComponents.subject = unescapeComponent(hfield[1], options);
                    break;
                  case "body":
                    mailtoComponents.body = unescapeComponent(hfield[1], options);
                    break;
                  default:
                    unknownHeaders = true;
                    headers[unescapeComponent(hfield[0], options)] = unescapeComponent(hfield[1], options);
                    break;
                }
              }
              if (unknownHeaders) mailtoComponents.headers = headers;
            }
            mailtoComponents.query = void 0;
            for (var _x2 = 0, _xl2 = to.length; _x2 < _xl2; ++_x2) {
              var addr = to[_x2].split("@");
              addr[0] = unescapeComponent(addr[0]);
              if (!options.unicodeSupport) {
                try {
                  addr[1] = punycode.toASCII(unescapeComponent(addr[1], options).toLowerCase());
                } catch (e) {
                  mailtoComponents.error = mailtoComponents.error || "Email address's domain name can not be converted to ASCII via punycode: " + e;
                }
              } else {
                addr[1] = unescapeComponent(addr[1], options).toLowerCase();
              }
              to[_x2] = addr.join("@");
            }
            return mailtoComponents;
          },
          serialize: function serialize$$1(mailtoComponents, options) {
            var components = mailtoComponents;
            var to = toArray(mailtoComponents.to);
            if (to) {
              for (var x = 0, xl = to.length; x < xl; ++x) {
                var toAddr = String(to[x]);
                var atIdx = toAddr.lastIndexOf("@");
                var localPart = toAddr.slice(0, atIdx).replace(PCT_ENCODED, decodeUnreserved).replace(PCT_ENCODED, toUpperCase).replace(NOT_LOCAL_PART, pctEncChar);
                var domain = toAddr.slice(atIdx + 1);
                try {
                  domain = !options.iri ? punycode.toASCII(unescapeComponent(domain, options).toLowerCase()) : punycode.toUnicode(domain);
                } catch (e) {
                  components.error = components.error || "Email address's domain name can not be converted to " + (!options.iri ? "ASCII" : "Unicode") + " via punycode: " + e;
                }
                to[x] = localPart + "@" + domain;
              }
              components.path = to.join(",");
            }
            var headers = mailtoComponents.headers = mailtoComponents.headers || {};
            if (mailtoComponents.subject) headers["subject"] = mailtoComponents.subject;
            if (mailtoComponents.body) headers["body"] = mailtoComponents.body;
            var fields = [];
            for (var name in headers) {
              if (headers[name] !== O[name]) {
                fields.push(name.replace(PCT_ENCODED, decodeUnreserved).replace(PCT_ENCODED, toUpperCase).replace(NOT_HFNAME, pctEncChar) + "=" + headers[name].replace(PCT_ENCODED, decodeUnreserved).replace(PCT_ENCODED, toUpperCase).replace(NOT_HFVALUE, pctEncChar));
              }
            }
            if (fields.length) {
              components.query = fields.join("&");
            }
            return components;
          }
        };
        var URN_PARSE = /^([^\:]+)\:(.*)/;
        var handler$5 = {
          scheme: "urn",
          parse: function parse$$1(components, options) {
            var matches = components.path && components.path.match(URN_PARSE);
            var urnComponents = components;
            if (matches) {
              var scheme = options.scheme || urnComponents.scheme || "urn";
              var nid = matches[1].toLowerCase();
              var nss = matches[2];
              var urnScheme = scheme + ":" + (options.nid || nid);
              var schemeHandler = SCHEMES[urnScheme];
              urnComponents.nid = nid;
              urnComponents.nss = nss;
              urnComponents.path = void 0;
              if (schemeHandler) {
                urnComponents = schemeHandler.parse(urnComponents, options);
              }
            } else {
              urnComponents.error = urnComponents.error || "URN can not be parsed.";
            }
            return urnComponents;
          },
          serialize: function serialize$$1(urnComponents, options) {
            var scheme = options.scheme || urnComponents.scheme || "urn";
            var nid = urnComponents.nid;
            var urnScheme = scheme + ":" + (options.nid || nid);
            var schemeHandler = SCHEMES[urnScheme];
            if (schemeHandler) {
              urnComponents = schemeHandler.serialize(urnComponents, options);
            }
            var uriComponents2 = urnComponents;
            var nss = urnComponents.nss;
            uriComponents2.path = (nid || options.nid) + ":" + nss;
            return uriComponents2;
          }
        };
        var UUID = /^[0-9A-Fa-f]{8}(?:\-[0-9A-Fa-f]{4}){3}\-[0-9A-Fa-f]{12}$/;
        var handler$6 = {
          scheme: "urn:uuid",
          parse: function parse2(urnComponents, options) {
            var uuidComponents = urnComponents;
            uuidComponents.uuid = uuidComponents.nss;
            uuidComponents.nss = void 0;
            if (!options.tolerant && (!uuidComponents.uuid || !uuidComponents.uuid.match(UUID))) {
              uuidComponents.error = uuidComponents.error || "UUID is not valid.";
            }
            return uuidComponents;
          },
          serialize: function serialize3(uuidComponents, options) {
            var urnComponents = uuidComponents;
            urnComponents.nss = (uuidComponents.uuid || "").toLowerCase();
            return urnComponents;
          }
        };
        SCHEMES[handler.scheme] = handler;
        SCHEMES[handler$1.scheme] = handler$1;
        SCHEMES[handler$2.scheme] = handler$2;
        SCHEMES[handler$3.scheme] = handler$3;
        SCHEMES[handler$4.scheme] = handler$4;
        SCHEMES[handler$5.scheme] = handler$5;
        SCHEMES[handler$6.scheme] = handler$6;
        exports2.SCHEMES = SCHEMES;
        exports2.pctEncChar = pctEncChar;
        exports2.pctDecChars = pctDecChars;
        exports2.parse = parse;
        exports2.removeDotSegments = removeDotSegments;
        exports2.serialize = serialize2;
        exports2.resolveComponents = resolveComponents;
        exports2.resolve = resolve;
        exports2.normalize = normalize;
        exports2.equal = equal;
        exports2.escapeComponent = escapeComponent;
        exports2.unescapeComponent = unescapeComponent;
        Object.defineProperty(exports2, "__esModule", { value: true });
      }));
    }
  });

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

  // packages/core/src/portable-url.ts
  var import_uri_js = __toESM(require_uri_all(), 1);
  function containsUrlWhitespaceOrControl(value) {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code <= 32 || code === 127) return true;
    }
    return false;
  }
  function hasValidRawAuthority(input) {
    const authorityStart = input.indexOf("://") + 3;
    const remainder = input.slice(authorityStart);
    const boundary = remainder.search(/[/?#]/);
    const authority = boundary === -1 ? remainder : remainder.slice(0, boundary);
    if (authority.length === 0) return false;
    const hostAndPort = authority.slice(authority.lastIndexOf("@") + 1);
    if (hostAndPort.startsWith("[")) {
      const closingBracket = hostAndPort.indexOf("]");
      if (closingBracket <= 1) return false;
      const suffix = hostAndPort.slice(closingBracket + 1);
      if (suffix === "") return true;
      if (!/^:\d+$/.test(suffix)) return false;
      const port2 = Number(suffix.slice(1));
      return Number.isInteger(port2) && port2 >= 0 && port2 <= 65535;
    }
    const separator = hostAndPort.lastIndexOf(":");
    if (separator === -1) return hostAndPort.length > 0;
    if (hostAndPort.indexOf(":") !== separator) return false;
    const hostname = hostAndPort.slice(0, separator);
    const portText = hostAndPort.slice(separator + 1);
    if (hostname.length === 0 || !/^\d+$/.test(portText)) return false;
    const port = Number(portText);
    return Number.isInteger(port) && port >= 0 && port <= 65535;
  }
  function isValidIpv4(hostname) {
    const octets = hostname.split(".");
    return octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255);
  }
  function isValidIpv6(hostname) {
    const zoneIndex = hostname.indexOf("%");
    const address = zoneIndex === -1 ? hostname : hostname.slice(0, zoneIndex);
    const zone = zoneIndex === -1 ? void 0 : hostname.slice(zoneIndex + 1);
    if (zone !== void 0 && !/^[A-Za-z0-9_.-]+$/.test(zone)) return false;
    if (!/^[0-9A-Fa-f:.]+$/.test(address) || !address.includes(":")) return false;
    if ((address.match(/::/g) ?? []).length > 1) return false;
    let groups = address.split(":");
    const last = groups[groups.length - 1];
    if (last?.includes(".")) {
      if (!isValidIpv4(last)) return false;
      groups = [...groups.slice(0, -1), "0", "0"];
    }
    const populated = groups.filter((group) => group.length > 0);
    if (populated.some((group) => !/^[0-9A-Fa-f]{1,4}$/.test(group))) return false;
    return address.includes("::") ? populated.length < 8 : populated.length === 8;
  }
  function isValidHostname(hostname) {
    if (hostname.includes(":")) return isValidIpv6(hostname);
    if (/^\d+(?:\.\d+){3}$/.test(hostname)) return isValidIpv4(hostname);
    const withoutFinalDot = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
    if (withoutFinalDot.length === 0 || withoutFinalDot.length > 253) return false;
    return withoutFinalDot.split(".").every((label) => {
      if (label.length === 0 || label.length > 63) return false;
      return /^[A-Za-z0-9_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?$/.test(label);
    });
  }
  function uriComponents(value) {
    const components = {
      scheme: value.scheme,
      host: value.hostname,
      path: value.pathname
    };
    if (value.userinfo !== void 0) components.userinfo = value.userinfo;
    if (value.port !== void 0) components.port = value.port;
    if (value.query !== void 0) components.query = value.query;
    if (value.fragment !== void 0) components.fragment = value.fragment;
    return components;
  }
  function originFromComponents(components) {
    const origin = (0, import_uri_js.serialize)({
      scheme: components.scheme,
      host: components.host,
      ...components.port === void 0 ? {} : { port: components.port },
      path: ""
    });
    return origin.endsWith("/") ? origin.slice(0, -1) : origin;
  }
  function parseAbsoluteUrl(input) {
    if (typeof input !== "string" || input.length === 0 || containsUrlWhitespaceOrControl(input)) {
      throw new TypeError("Invalid URL");
    }
    if (!/^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(input)) throw new TypeError("Invalid URL");
    if (!hasValidRawAuthority(input)) throw new TypeError("Invalid URL");
    const normalized = (0, import_uri_js.normalize)(input);
    const components = (0, import_uri_js.parse)(normalized);
    if (components.error !== void 0 || components.scheme === void 0 || components.host === void 0 || components.host.length === 0 || !isValidHostname(components.host) || components.port === "") {
      throw new TypeError("Invalid URL");
    }
    const port = components.port === void 0 ? void 0 : Number(components.port);
    if (port !== void 0 && (!Number.isInteger(port) || port < 0 || port > 65535)) {
      throw new TypeError("Invalid URL");
    }
    const canonical = {
      scheme: components.scheme.toLowerCase(),
      host: components.host.toLowerCase(),
      path: components.path ?? ""
    };
    if (components.userinfo !== void 0) canonical.userinfo = components.userinfo;
    if (port !== void 0) canonical.port = port;
    if (components.query !== void 0) canonical.query = components.query;
    if (components.fragment !== void 0) canonical.fragment = components.fragment;
    const href = (0, import_uri_js.serialize)(canonical);
    return {
      scheme: canonical.scheme,
      userinfo: canonical.userinfo,
      hostname: canonical.host,
      port,
      pathname: canonical.path ?? "",
      query: canonical.query,
      fragment: canonical.fragment,
      origin: originFromComponents(canonical),
      href
    };
  }
  function serializeAbsoluteUrl(value) {
    return (0, import_uri_js.serialize)(uriComponents(value));
  }
  function encodeQueryComponent(value) {
    let scalarValue = "";
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code >= 55296 && code <= 56319) {
        const next = value.charCodeAt(index + 1);
        if (next >= 56320 && next <= 57343) {
          scalarValue += value.charAt(index) + value.charAt(index + 1);
          index += 1;
        } else {
          scalarValue += "�";
        }
      } else if (code >= 56320 && code <= 57343) {
        scalarValue += "�";
      } else {
        scalarValue += value.charAt(index);
      }
    }
    return encodeURIComponent(scalarValue).replace(/%20/g, "+");
  }
  function decodeQueryComponent(value) {
    try {
      return decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      return value.replace(/\+/g, " ");
    }
  }
  function queryEntries(query) {
    if (query === void 0 || query.length === 0) return [];
    return query.split("&").map((entry) => {
      const separator = entry.indexOf("=");
      if (separator === -1) return [decodeQueryComponent(entry), ""];
      return [
        decodeQueryComponent(entry.slice(0, separator)),
        decodeQueryComponent(entry.slice(separator + 1))
      ];
    });
  }
  function isSecretQueryParameterName(name) {
    let decoded = name;
    for (let depth = 0; depth < 3; depth += 1) {
      let next;
      try {
        next = decodeURIComponent(decoded.replace(/\+/g, " "));
      } catch {
        break;
      }
      if (next === decoded) break;
      decoded = next;
    }
    const normalized = decoded.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized === "apikey" || normalized === "passwd" || normalized === "pw" || normalized.endsWith("token") || normalized.endsWith("password") || normalized.endsWith("secret") || normalized.endsWith("secretkey");
  }
  function hasSecretQueryParameter(value) {
    try {
      return queryEntries(parseAbsoluteUrl(value).query).some(
        ([name]) => isSecretQueryParameterName(name)
      );
    } catch {
      return false;
    }
  }
  function encodeQueryEntries(entries) {
    return entries.map(([name, value]) => `${encodeQueryComponent(name)}=${encodeQueryComponent(value)}`).join("&");
  }
  function queryValueCaseInsensitive(url, name) {
    const wanted = name.toLowerCase();
    const parsed = (0, import_uri_js.parse)(url);
    if (parsed.error !== void 0) return void 0;
    return queryEntries(parsed.query).find(([entryName]) => entryName.toLowerCase() === wanted)?.[1];
  }
  function isAbsoluteHttpUrl(value) {
    try {
      const parsed = parseAbsoluteUrl(value);
      return parsed.scheme === "http" || parsed.scheme === "https";
    } catch {
      return false;
    }
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
    let withScheme = trimmed;
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) {
      const localCandidate = `http://${trimmed}`;
      try {
        withScheme = isLocalHostname(parseAbsoluteUrl(localCandidate).hostname) ? localCandidate : `https://${trimmed}`;
      } catch {
        withScheme = `https://${trimmed}`;
      }
    }
    try {
      return parseAbsoluteUrl(withScheme);
    } catch {
      throw new ServerUrlError("INVALID_URL", "The Jellyfin server URL is not valid");
    }
  }
  function normalizeServerUrl(input, options = {}) {
    const parsed = parseUserSuppliedUrl(input);
    if (parsed.scheme !== "http" && parsed.scheme !== "https") {
      throw new ServerUrlError("UNSUPPORTED_PROTOCOL", "Jellyfin servers must use HTTP or HTTPS");
    }
    if (parsed.userinfo !== void 0) {
      throw new ServerUrlError(
        "URL_CREDENTIALS_NOT_ALLOWED",
        "Do not put credentials in the server URL"
      );
    }
    if (parsed.query !== void 0 || parsed.fragment !== void 0) {
      throw new ServerUrlError(
        "URL_QUERY_NOT_ALLOWED",
        "The server URL cannot contain a query or fragment"
      );
    }
    const local = isLocalHostname(parsed.hostname);
    if (parsed.scheme === "http" && !local && options.allowInsecureRemote !== true) {
      throw new ServerUrlError(
        "INSECURE_REMOTE_SERVER",
        "Remote Jellyfin servers must use HTTPS unless insecure access is explicitly accepted"
      );
    }
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    const origin = parsed.origin;
    const url = `${origin}${path}`;
    const policy = parsed.scheme === "https" ? "https" : local ? "local-http-warning" : "remote-http-accepted";
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
  var absoluteHttpUrl = external_exports.string().refine(isAbsoluteHttpUrl, { message: "Invalid URL" });
  var credentialSafeAbsoluteHttpUrl = absoluteHttpUrl.refine(
    (url) => !hasSecretQueryParameter(url),
    { message: "URL query parameters must not contain credentials" }
  );
  var ConnectionMetadataSchema = external_exports.object({
    schemaVersion: external_exports.literal(1),
    serverUrl: absoluteHttpUrl,
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
      parentId: identifier,
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
    videoTranscodeConfirmationId: identifier.optional()
  }).strict();
  var PlayMethodSchema = external_exports.enum(["DirectPlay", "DirectStream", "Transcode"]);
  var PlaybackPlanSchema = external_exports.object({
    itemId: identifier,
    playSessionId: identifier,
    mediaSourceId: identifier,
    url: credentialSafeAbsoluteHttpUrl,
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
      deliveryUrl: credentialSafeAbsoluteHttpUrl,
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
  var imageTags = external_exports.record(external_exports.string().max(512)).transform((value) => Object.fromEntries(Object.entries(value).slice(0, 16))).nullable();
  var backdropImageTags = external_exports.preprocess(
    (value) => Array.isArray(value) ? value.slice(0, 8) : value,
    external_exports.array(external_exports.string().max(512)).max(8)
  ).nullable();
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
    CollectionType: external_exports.string().max(128).nullable().optional(),
    LocationType: external_exports.string().max(128).nullable().optional(),
    IsPlaceHolder: external_exports.boolean().nullable().optional(),
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
    BackdropImageTags: backdropImageTags.optional(),
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
  var absoluteHttpUrl2 = external_exports.string().max(2048).refine(isAbsoluteHttpUrl, {
    message: "Invalid URL"
  });
  var publicConnection = external_exports.object({
    serverUrl: absoluteHttpUrl2,
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
      normalizedUrl: absoluteHttpUrl2,
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
    "playback.start": external_exports.discriminatedUnion("status", [
      external_exports.object({
        status: external_exports.literal("started"),
        playbackId: identifier3,
        plan: PublicPlaybackPlanSchema
      }).strict(),
      external_exports.object({
        status: external_exports.literal("confirmation-required"),
        plan: PublicPlaybackPlanSchema,
        confirmationId: identifier3
      }).strict()
    ]),
    "playback.stop": external_exports.object({ stopped: external_exports.literal(true) }).strict(),
    "catalog.refresh": external_exports.object({
      connection: publicConnection.optional(),
      refreshedAt: external_exports.string().datetime({ offset: true })
    }).strict()
  };

  // packages/core/src/ticks.ts
  var JELLYFIN_TICKS_PER_SECOND = 1e7;
  function finiteNonNegative(value, name) {
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError(`${name} must be a finite non-negative number`);
    return value;
  }
  function safeInteger(value) {
    if (!Number.isSafeInteger(value))
      throw new RangeError("The converted tick value exceeds JavaScript's safe range");
    return value;
  }
  function secondsToTicks(seconds) {
    return safeInteger(Math.round(finiteNonNegative(seconds, "seconds") * JELLYFIN_TICKS_PER_SECOND));
  }
  function ticksToSeconds(ticks) {
    return finiteNonNegative(ticks, "ticks") / JELLYFIN_TICKS_PER_SECOND;
  }
  function clampPositionTicks(positionTicks, durationTicks) {
    const position2 = safeInteger(Math.round(finiteNonNegative(positionTicks, "positionTicks")));
    if (durationTicks === void 0) return position2;
    const duration = safeInteger(Math.round(finiteNonNegative(durationTicks, "durationTicks")));
    return Math.min(position2, duration);
  }

  // packages/core/src/playback.ts
  function normalizedVolume(level) {
    if (level === void 0 || !Number.isFinite(level)) return 100;
    return Math.max(0, Math.min(100, Math.round(level)));
  }
  function buildPlaybackReportPayload(kind, state, telemetry = {}) {
    if (state.plan === void 0 || state.status === "idle" || state.status === "preparing") {
      throw new Error("Playback cannot be reported before media has started");
    }
    const isStopped = kind === "stopped" || state.status === "stopped" || state.status === "error";
    const payload = {
      ItemId: state.plan.itemId,
      MediaSourceId: state.plan.mediaSourceId,
      PlaySessionId: state.plan.playSessionId,
      PositionTicks: clampPositionTicks(state.positionTicks, state.durationTicks),
      CanSeek: telemetry.canSeek ?? true,
      IsPaused: !isStopped && state.status === "paused",
      IsMuted: telemetry.isMuted ?? false,
      IsPlaying: !isStopped && state.status === "playing",
      IsMediaSegmentAction: false,
      PlayMethod: state.plan.playMethod,
      VolumeLevel: normalizedVolume(telemetry.volumeLevel)
    };
    if (state.plan.audioStreamIndex !== void 0)
      payload.AudioStreamIndex = state.plan.audioStreamIndex;
    if (state.plan.subtitleStreamIndex !== void 0)
      payload.SubtitleStreamIndex = state.plan.subtitleStreamIndex;
    if (kind === "progress") payload.EventName = telemetry.eventName ?? "timeupdate";
    if (kind === "stopped") payload.Failed = telemetry.failed ?? state.status === "error";
    return payload;
  }
  function buildPlaybackReportRequest(kind, state, context, telemetry = {}) {
    const endpoint = kind === "start" ? "Sessions/Playing" : kind === "progress" ? "Sessions/Playing/Progress" : "Sessions/Playing/Stopped";
    return {
      method: "POST",
      url: joinJellyfinPath(context.serverUrl, endpoint),
      headers: {
        ...createAuthorizationHeaders({
          client: context.client ?? DEFAULT_CLIENT_NAME,
          device: context.device ?? DEFAULT_DEVICE_NAME,
          deviceId: context.deviceId,
          version: context.version,
          accessToken: context.accessToken
        }),
        "Content-Type": "application/json"
      },
      body: buildPlaybackReportPayload(kind, state, telemetry)
    };
  }

  // packages/core/src/playback-state.ts
  var safeTicks2 = external_exports.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  var safeIndex = external_exports.number().int().nonnegative().max(1e6);
  var safeText = external_exports.string().trim().min(1).max(512);
  var PublicPlaybackStateSchema = external_exports.object({
    version: external_exports.literal(1),
    playbackId: external_exports.string().trim().min(1).max(128),
    sequence: external_exports.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    generation: external_exports.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    status: external_exports.enum(["preparing", "playing", "paused", "stopped", "error"]),
    itemId: external_exports.string().trim().min(1).max(512),
    positionTicks: safeTicks2,
    durationTicks: safeTicks2.optional(),
    playbackRate: external_exports.number().finite().min(0.01).max(100).optional(),
    isBuffering: external_exports.boolean().optional(),
    title: safeText,
    seriesName: safeText.optional(),
    seasonNumber: safeIndex.optional(),
    episodeNumber: safeIndex.optional(),
    playMethod: PlayMethodSchema,
    stopReason: external_exports.enum(["completed", "closed", "replaced", "failed", "user"]).optional(),
    startedAtMs: external_exports.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    updatedAtMs: external_exports.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
  }).strict();
  var PublicPlaybackStateRemovalSchema = external_exports.object({
    version: external_exports.literal(1),
    playbackId: external_exports.string().trim().min(1).max(128),
    generation: external_exports.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    sequence: external_exports.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    removedAtMs: external_exports.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
  }).strict();
  function serializePublicPlaybackState(state) {
    return JSON.stringify(PublicPlaybackStateSchema.parse(state));
  }

  // packages/core/src/preference-contracts.ts
  var CATALOG_OPEN_REQUEST_PREFERENCE_KEY = "catalogOpenRequestAtMs";

  // packages/core/src/redaction.ts
  var REDACTED = "[REDACTED]";
  var SECRET_KEY = /(?:authorization|x-emby-token|token|api[_-]?key|password|passwd|\bpw|secret)$/i;
  function redactUrl(value) {
    try {
      const url = parseAbsoluteUrl(value);
      let changed = false;
      const passwordSeparator = url.userinfo?.indexOf(":") ?? -1;
      if (url.userinfo !== void 0 && passwordSeparator >= 0) {
        url.userinfo = `${url.userinfo.slice(0, passwordSeparator)}:${REDACTED}`;
        changed = true;
      }
      let queryChanged = false;
      const entries = queryEntries(url.query).map(([key, entryValue]) => {
        if (isSecretQueryParameterName(key)) {
          changed = true;
          queryChanged = true;
          return [key, REDACTED];
        }
        return [key, entryValue];
      });
      if (queryChanged) url.query = encodeQueryEntries(entries);
      return changed ? serializeAbsoluteUrl(url) : void 0;
    } catch {
      return void 0;
    }
  }
  function redactJsonDocument(value) {
    const trimmed = value.trim();
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return void 0;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed === null || typeof parsed !== "object") return void 0;
      return JSON.stringify(redactSecrets(parsed));
    } catch {
      return void 0;
    }
  }
  function redactString(value) {
    const wholeUrl = redactUrl(value);
    if (wholeUrl !== void 0) return wholeUrl;
    const jsonDocument = redactJsonDocument(value);
    if (jsonDocument !== void 0) return jsonDocument;
    return value.replace(
      /("(?:access[_-]?token|token|api[_-]?key|password|passwd|pw|secret)"\s*:\s*")[^"]*(")/gi,
      `$1${REDACTED}$2`
    ).replace(
      /([?&](?:api[_-]?key|[a-z0-9_.-]*(?:token|password|secret(?:[_-]?key)?)|passwd|pw)=)([^&#\s]*)/gi,
      (_match, prefix) => `${prefix}${encodeURIComponent(REDACTED)}`
    ).replace(/(MediaBrowser\s+[^\r\n]*?\bToken=\\")[^"\\]*(\\")/gi, `$1${REDACTED}$2`).replace(
      /(\b(?:api[_-]?key|[a-z0-9_.-]*(?:token|password|secret(?:[_-]?key)?)|passwd|pw)=)("[^"]*"|'[^']*'|[^\\&#\s,;"']+)/gi,
      (_match, prefix, secretValue) => {
        const quote = secretValue.startsWith('"') ? '"' : secretValue.startsWith("'") ? "'" : "";
        return `${prefix}${quote}${REDACTED}${quote}`;
      }
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

  // packages/core/src/session.ts
  function createIdlePlaybackSession() {
    return {
      generation: 0,
      status: "idle",
      positionTicks: 0
    };
  }
  function beginPlaybackSession(state, plan) {
    const next = {
      generation: state.generation + 1,
      status: "preparing",
      plan,
      positionTicks: plan.startPositionTicks
    };
    if (plan.runtimeTicks !== void 0) next.durationTicks = plan.runtimeTicks;
    return next;
  }
  function active(state) {
    return state.status === "preparing" || state.status === "playing" || state.status === "paused";
  }
  function position(state, value) {
    return clampPositionTicks(value, state.durationTicks);
  }
  function reducePlaybackSession(state, event) {
    if (event.generation !== state.generation || state.plan === void 0) return state;
    switch (event.type) {
      case "media-started": {
        if (state.status !== "preparing") return state;
        const next = {
          ...state,
          status: "playing",
          positionTicks: position(state, event.positionTicks ?? state.positionTicks)
        };
        if (event.durationTicks !== void 0) {
          next.durationTicks = event.durationTicks;
          next.positionTicks = clampPositionTicks(next.positionTicks, event.durationTicks);
        }
        return next;
      }
      case "pause":
        return state.status === "playing" ? { ...state, status: "paused", positionTicks: position(state, event.positionTicks) } : state;
      case "resume":
        return state.status === "paused" ? { ...state, status: "playing", positionTicks: position(state, event.positionTicks) } : state;
      case "seek":
        return active(state) ? { ...state, positionTicks: position(state, event.positionTicks) } : state;
      case "time-update": {
        if (!active(state)) return state;
        const next = { ...state, positionTicks: position(state, event.positionTicks) };
        if (event.durationTicks !== void 0) {
          next.durationTicks = event.durationTicks;
          next.positionTicks = clampPositionTicks(event.positionTicks, event.durationTicks);
        }
        return next;
      }
      case "progress-reported":
        return active(state) ? { ...state, lastProgressReportAtMs: event.atMs } : state;
      case "stop":
        return active(state) ? {
          ...state,
          status: "stopped",
          positionTicks: position(state, event.positionTicks),
          stopReason: event.reason
        } : state;
      case "complete":
        return active(state) ? {
          ...state,
          status: "stopped",
          positionTicks: position(state, event.positionTicks),
          stopReason: "completed"
        } : state;
      case "fail":
        return active(state) ? {
          ...state,
          status: "error",
          positionTicks: position(state, event.positionTicks),
          stopReason: "failed",
          errorMessage: event.message.slice(0, 2e3)
        } : state;
    }
  }
  function shouldReportPeriodicProgress(state, nowMs, intervalMs = 1e4) {
    if (state.status !== "playing" || state.plan === void 0) return false;
    if (!Number.isFinite(nowMs) || nowMs < 0) return false;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0)
      throw new RangeError("intervalMs must be positive");
    return state.lastProgressReportAtMs === void 0 || nowMs - state.lastProgressReportAtMs >= intervalMs;
  }

  // packages/plugin/src/diagnostic-log.ts
  var DIAGNOSTIC_LOG_PATH = "@data/jellyfin-diagnostics.log";
  var PREVIOUS_DIAGNOSTIC_LOG_PATH = "@data/jellyfin-diagnostics.previous.log";
  var MAX_DIAGNOSTIC_LOG_BYTES = 512 * 1024;
  var MAX_PLAYER_DIAGNOSTIC_GENERATIONS = 32;
  var PLAYER_DIAGNOSTIC_FILE_PREFIX = "jellyfin-player-diagnostics-";
  var MAX_PLAYER_DIAGNOSTIC_ID_CHARS = 64;
  var MAX_DIAGNOSTIC_MESSAGE_CHARS = 16 * 1024;
  var MAX_APPEND_ATTEMPTS = 3;
  var DEFAULT_DIAGNOSTIC_LOG_PATHS = {
    current: DIAGNOSTIC_LOG_PATH,
    previous: PREVIOUS_DIAGNOSTIC_LOG_PATH
  };
  function utf8ByteLength(value) {
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code <= 127) {
        bytes += 1;
      } else if (code <= 2047) {
        bytes += 2;
      } else if (code >= 55296 && code <= 56319) {
        const next = value.charCodeAt(index + 1);
        if (next >= 56320 && next <= 57343) index += 1;
        bytes += 4;
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }
  function scrubLocalPaths(value) {
    return value.replace(/\/Users\/[^/\s"']+/g, "~");
  }
  function safeDiagnosticMessage(value) {
    const sanitized = scrubLocalPaths(redactString(value)).replace(
      /\bhttps?:\/\/[^\s"']+/gi,
      "[URL_REDACTED]"
    );
    if (sanitized.length <= MAX_DIAGNOSTIC_MESSAGE_CHARS) return sanitized;
    return `${sanitized.slice(0, MAX_DIAGNOSTIC_MESSAGE_CHARS)}…[TRUNCATED]`;
  }
  function safePlayerDiagnosticId(value) {
    const safe = value.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, MAX_PLAYER_DIAGNOSTIC_ID_CHARS);
    return safe || "player";
  }
  function createPlayerDiagnosticLogPaths(generationId) {
    const safeId = safePlayerDiagnosticId(generationId);
    const base = `@data/${PLAYER_DIAGNOSTIC_FILE_PREFIX}${safeId}`;
    return {
      generationId: safeId,
      current: `${base}.log`,
      previous: `${base}.previous.log`
    };
  }
  function prunePlayerDiagnosticLogs(file, currentGenerationId, maxGenerations = MAX_PLAYER_DIAGNOSTIC_GENERATIONS) {
    try {
      if (!Number.isSafeInteger(maxGenerations) || maxGenerations < 1) return;
      const pattern = new RegExp(
        `^${PLAYER_DIAGNOSTIC_FILE_PREFIX}([a-zA-Z0-9-]{1,${MAX_PLAYER_DIAGNOSTIC_ID_CHARS}})(?:\\.previous)?\\.log$`
      );
      const filesByGeneration = /* @__PURE__ */ new Map();
      for (const entry of file.list("@data/", { includeSubDir: false })) {
        if (entry.isDir) continue;
        const match = pattern.exec(entry.filename);
        if (!match) continue;
        const generation = match[1];
        if (generation === void 0) continue;
        const paths = filesByGeneration.get(generation) ?? [];
        paths.push(`@data/${entry.filename}`);
        filesByGeneration.set(generation, paths);
      }
      const current = safePlayerDiagnosticId(currentGenerationId);
      const newestFirst = [...filesByGeneration.keys()].sort(
        (left, right) => right.localeCompare(left)
      );
      const retained = /* @__PURE__ */ new Set([current]);
      for (const generation of newestFirst) {
        if (retained.size >= maxGenerations) break;
        retained.add(generation);
      }
      for (const [generation, paths] of filesByGeneration) {
        if (retained.has(generation)) continue;
        for (const path of paths) {
          try {
            file.delete(path);
          } catch {
          }
        }
      }
    } catch {
    }
  }
  var PersistentDiagnosticLog = class {
    constructor(file, onFailure = () => void 0, now = Date.now, maxBytes = MAX_DIAGNOSTIC_LOG_BYTES, paths = DEFAULT_DIAGNOSTIC_LOG_PATHS) {
      this.file = file;
      this.onFailure = onFailure;
      this.now = now;
      this.maxBytes = maxBytes;
      this.paths = paths;
      try {
        this.normalizeExistingFile(this.paths.current);
        this.normalizeExistingFile(this.paths.previous);
      } catch {
        this.reportFailureOnce();
      }
    }
    file;
    onFailure;
    now;
    maxBytes;
    paths;
    warnedAboutFailure = false;
    append(level, scope, message, source) {
      try {
        const timestamp = new Date(this.now()).toISOString();
        const record = {
          timestamp,
          level,
          scope,
          message: safeDiagnosticMessage(message)
        };
        if (source !== void 0) record.source = safeDiagnosticMessage(source).slice(0, 128);
        const line = `${JSON.stringify(record)}
`;
        const lineBytes = utf8ByteLength(line);
        this.normalizeExistingFile(this.paths.current);
        this.normalizeExistingFile(this.paths.previous);
        if (lineBytes > this.maxBytes) return;
        for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
          if (!this.file.exists(this.paths.current)) {
            this.file.write(this.paths.current, "");
          }
          const handle = this.file.handle(this.paths.current, "write");
          let currentSize;
          try {
            handle.seekToEnd();
            currentSize = handle.offset();
            if (Number.isSafeInteger(currentSize) && currentSize >= 0 && currentSize <= this.maxBytes && currentSize + lineBytes <= this.maxBytes) {
              handle.write(line);
            }
          } finally {
            handle.close();
          }
          if (!Number.isSafeInteger(currentSize) || currentSize < 0 || currentSize > this.maxBytes) {
            this.file.write(this.paths.current, "");
            continue;
          }
          if (currentSize + lineBytes > this.maxBytes) {
            this.rotateCurrentFile();
            continue;
          }
          const resultingSize = this.normalizeExistingFile(this.paths.current);
          this.normalizeExistingFile(this.paths.previous);
          if (resultingSize >= lineBytes) return;
        }
        this.normalizeExistingFile(this.paths.current);
        this.normalizeExistingFile(this.paths.previous);
      } catch {
        this.reportFailureOnce();
      }
    }
    reveal() {
      try {
        if (!this.file.exists(this.paths.current)) {
          this.file.write(this.paths.current, "");
        }
        this.file.showInFinder(this.paths.current);
      } catch {
        this.reportFailureOnce();
      }
    }
    normalizeExistingFile(path) {
      if (!this.file.exists(path)) return 0;
      const handle = this.file.handle(path, "read");
      let size;
      try {
        handle.seekToEnd();
        size = handle.offset();
      } finally {
        handle.close();
      }
      if (!Number.isSafeInteger(size) || size < 0 || size > this.maxBytes) {
        this.file.write(path, "");
        return 0;
      }
      return size;
    }
    rotateCurrentFile() {
      const currentSize = this.normalizeExistingFile(this.paths.current);
      let current = currentSize > 0 ? this.file.read(this.paths.current) ?? "" : "";
      if (utf8ByteLength(current) > this.maxBytes) current = "";
      this.file.write(this.paths.previous, current);
      this.file.write(this.paths.current, "");
      this.normalizeExistingFile(this.paths.previous);
      this.normalizeExistingFile(this.paths.current);
    }
    reportFailureOnce() {
      if (this.warnedAboutFailure) return;
      this.warnedAboutFailure = true;
      try {
        this.onFailure("Jellyfin diagnostics could not be written to plugin-private storage.");
      } catch {
      }
    }
  };
  function createPlayerDiagnosticSink(consoleApi, forward) {
    const write = (level, message) => {
      const safeMessage = safeDiagnosticMessage(message);
      try {
        if (level === "info") consoleApi.log(safeMessage);
        else if (level === "warn") consoleApi.warn(safeMessage);
        else consoleApi.error(safeMessage);
      } catch {
      }
      try {
        forward({ level, message: safeMessage });
      } catch {
      }
    };
    return {
      log: (message) => write("info", message),
      warn: (message) => write("warn", message),
      error: (message) => write("error", message)
    };
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
        let origin = "the configured Jellyfin server";
        try {
          origin = parseAbsoluteUrl(request.url).origin;
        } catch {
        }
        throw new JellyfinHttpError(
          0,
          true,
          `Could not download media from ${redactString(origin)}.`
        );
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

  // packages/plugin/src/constants.ts
  var DEFAULT_PROGRESS_INTERVAL_MS = 1e4;
  var DEFAULT_ARTWORK_LIMIT_BYTES = 8 * 1024 * 1024;
  var PLAYER_MESSAGES = {
    catalogOpen: "jellyfin.catalog.open",
    closed: "jellyfin.player.closed",
    diagnostic: "jellyfin.player.diagnostic",
    launch: "jellyfin.player.launch",
    playNext: "jellyfin.player.play-next",
    ready: "jellyfin.player.ready",
    state: "jellyfin.player.state",
    stop: "jellyfin.player.stop",
    upNext: "jellyfin.player.up-next"
  };

  // packages/plugin/src/playback-state-mailbox.ts
  var PLAYBACK_STATE_FILE_PREFIX = "jellyfin-playback-state-";
  var PLAYBACK_STATE_FILE_SUFFIX = ".json";
  var SAFE_PLAYBACK_ID = /^[A-Za-z0-9-]{1,128}$/;
  function playbackStatePath(playbackId) {
    if (!SAFE_PLAYBACK_ID.test(playbackId)) throw new Error("Invalid public playback identifier.");
    return `@tmp/${PLAYBACK_STATE_FILE_PREFIX}${playbackId}${PLAYBACK_STATE_FILE_SUFFIX}`;
  }
  function writePlaybackState(file, state) {
    file.write(playbackStatePath(state.playbackId), serializePublicPlaybackState(state));
  }

  // packages/plugin/src/player-runtime.ts
  var StalePlayerLoadError = class extends Error {
    constructor() {
      super("A newer player load replaced this request.");
      this.name = "StalePlayerLoadError";
    }
  };
  var MAX_EXTERNAL_SUBTITLE_BYTES = 10 * 1024 * 1024;
  var CORE_STOP_ACK_TIMEOUT_MS = 750;
  function safeHeaders(headers) {
    const result = [];
    for (const [name, value] of Object.entries(headers)) {
      if (!/^[A-Za-z0-9-]+$/.test(name) || /[\r\n]/.test(value)) continue;
      result.push(`${name}: ${value}`);
    }
    return result;
  }
  function safeSubtitleExtension(codec) {
    const normalized = codec?.toLowerCase();
    return normalized === "ass" || normalized === "ssa" || normalized === "vtt" ? normalized : "srt";
  }
  function safeTemporaryNameComponent(value) {
    const normalized = value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 96);
    return normalized.length > 0 ? normalized : "playback";
  }
  function transcodeStartOffset(plan) {
    if (plan.playMethod === "DirectPlay") return 0;
    try {
      const value = queryValueCaseInsensitive(plan.url, "StartTimeTicks");
      const parsed = Number(value);
      return value !== void 0 && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
    } catch {
    }
    return 0;
  }
  function localStartPositionSeconds(plan) {
    const serverStartOffset = transcodeStartOffset(plan);
    return ticksToSeconds(Math.max(0, plan.startPositionTicks - serverStartOffset));
  }
  function mediaTitle(display) {
    if (display.seriesName !== void 0 && display.seasonNumber !== void 0 && display.episodeNumber !== void 0) {
      return `${display.seriesName} — S${String(display.seasonNumber).padStart(2, "0")}E${String(display.episodeNumber).padStart(2, "0")} — ${display.title}`;
    }
    return display.title;
  }
  var PlayerRuntime = class {
    constructor(api2, transport, logger2) {
      this.api = api2;
      this.transport = transport;
      this.logger = logger2;
    }
    api;
    transport;
    logger;
    session = createIdlePlaybackSession();
    launch;
    pendingLaunchesForHook = [];
    startedGeneration = -1;
    positionBaseTicks = 0;
    progressTimer;
    sidebarReady = false;
    overlayReady = false;
    upNext;
    upNextTimer;
    externalSubtitlePath;
    reportQueue = Promise.resolve();
    controlQueue = Promise.resolve();
    replacementSequence = 0;
    replacementEndFilesToIgnore = 0;
    pendingCoreStopAcknowledgement;
    loadSequence = 0;
    activeLoadReplacementSequence;
    playbackStateSequence = 0;
    playbackStartedAtMs = 0;
    playbackStatePersistenceFailed = false;
    install() {
      this.api.global.onMessage(PLAYER_MESSAGES.launch, (raw) => this.receiveLaunch(raw));
      this.api.global.onMessage(PLAYER_MESSAGES.stop, (raw) => {
        const requested = raw.reason;
        const reason = requested === "closed" || requested === "replaced" ? requested : "user";
        this.replacementSequence += 1;
        this.discardPendingHandoffs();
        this.invalidatePendingLoads();
        this.enqueueControl(() => this.stop(reason, false));
      });
      this.api.global.onMessage(PLAYER_MESSAGES.upNext, (raw) => this.receiveUpNext(raw));
      this.api.mpv.addHook("on_load", 90, async (next) => {
        await this.resolveLoad(next);
      });
      this.api.event.on("iina.window-loaded", () => this.loadPlayerViews());
      this.api.event.on("iina.file-loaded", () => void this.mediaLoaded());
      this.api.event.on("mpv.pause.changed", () => void this.pauseChanged());
      this.api.event.on("mpv.speed.changed", () => this.playbackTimingChanged());
      this.api.event.on("mpv.paused-for-cache.changed", () => this.playbackTimingChanged());
      this.api.event.on("mpv.seek", () => void this.reportImmediate("seek"));
      this.api.event.on("mpv.end-file", () => {
        this.handleEndFile();
      });
      this.api.event.on("iina.window-will-close", () => {
        this.clearProgressTimer();
        this.replacementSequence += 1;
        this.discardPendingHandoffs();
        this.invalidatePendingLoads();
        this.enqueueControl(() => this.stop("closed", true));
      });
      this.api.sidebar.onMessage("host.action", (data) => this.handleViewAction(data, "sidebar"));
      this.api.overlay.onMessage("host.action", (data) => this.handleViewAction(data, "overlay"));
      this.ensureProgressTimer();
    }
    receiveLaunch(raw) {
      if (raw === null || typeof raw !== "object") return;
      const candidate = raw;
      if (typeof candidate.nonce !== "string" || candidate.context === void 0 || candidate.display === void 0) {
        return;
      }
      const parsed = PlaybackPlanSchema.safeParse(candidate.plan);
      if (!parsed.success) return;
      const launch = {
        nonce: candidate.nonce,
        plan: parsed.data,
        context: candidate.context,
        display: candidate.display
      };
      if (typeof candidate.diagnosticCorrelation === "string" && candidate.diagnosticCorrelation.length <= 512) {
        launch.diagnosticCorrelation = candidate.diagnosticCorrelation;
      }
      this.ensureProgressTimer();
      const sequence = ++this.replacementSequence;
      this.invalidatePendingLoads();
      this.enqueueControl(() => this.replace(launch, sequence));
    }
    async resolveLoad(next) {
      const original = this.api.mpv.getString("stream-open-filename");
      if (original !== "null://") {
        const ownedLaunch = this.launch;
        const ownedGeneration = this.session.generation;
        this.replacementSequence += 1;
        this.discardPendingHandoffs();
        this.invalidatePendingLoads();
        try {
          if (ownedLaunch !== void 0) await this.releaseForExternalLoad();
        } catch (error) {
          this.logger.warn("Could not release Jellyfin playback for an external load", error);
        } finally {
          if (ownedLaunch !== void 0) {
            this.clearUpNext(true);
            this.cleanupPlaybackIfOwned(ownedLaunch, ownedGeneration);
          }
          next?.();
        }
        return;
      }
      let pending;
      while (this.pendingLaunchesForHook.length > 0) {
        const candidate = this.pendingLaunchesForHook.shift();
        if (candidate?.replacementSequence === this.replacementSequence) {
          pending = candidate;
          break;
        }
      }
      if (pending === void 0) {
        next?.();
        return;
      }
      const loadSequence = this.beginLoad();
      this.deleteExternalSubtitle();
      try {
        const launch = pending.launch;
        this.launch = launch;
        this.activeLoadReplacementSequence = pending.replacementSequence;
        this.session = beginPlaybackSession(this.session, launch.plan);
        this.playbackStartedAtMs = Date.now();
        const generation = this.session.generation;
        this.publishState();
        this.logger.info("player.plan.received", {
          correlation: launch.diagnosticCorrelation,
          playMethod: launch.plan.playMethod,
          conversion: launch.plan.conversion,
          resume: launch.plan.startPositionTicks > 0,
          externalSubtitle: launch.plan.externalSubtitle !== void 0,
          selectedAudio: launch.plan.audioStreamIndex !== void 0,
          selectedSubtitles: launch.plan.subtitleStreamIndex !== void 0
        });
        this.positionBaseTicks = transcodeStartOffset(launch.plan);
        this.api.mpv.set("file-local-options/resume-playback", false);
        this.api.mpv.set("file-local-options/save-position-on-quit", false);
        this.api.mpv.set("file-local-options/start", localStartPositionSeconds(launch.plan));
        this.api.mpv.set("http-header-fields", safeHeaders(launch.plan.headers));
        this.api.mpv.set("file-local-options/force-media-title", mediaTitle(launch.display));
        this.api.mpv.set("stream-open-filename", launch.plan.url);
        if (launch.plan.externalSubtitle !== void 0) {
          try {
            await this.downloadExternalSubtitle(launch, loadSequence, generation);
            if (loadSequence !== this.loadSequence || this.launch !== launch || this.session.generation !== generation) {
              return;
            }
          } catch (error) {
            if (error instanceof StalePlayerLoadError || loadSequence !== this.loadSequence) return;
            this.logger.warn("Could not download the selected Jellyfin subtitle", error);
            this.api.core.osd("The selected subtitle could not be loaded. Playback will continue.");
            this.deleteExternalSubtitle();
          }
        }
        this.logger.info("player.media.opening", {
          correlation: launch.diagnosticCorrelation,
          playMethod: launch.plan.playMethod
        });
        this.publishState();
      } catch (error) {
        if (error instanceof StalePlayerLoadError || loadSequence !== this.loadSequence) return;
        this.logger.error("Could not prepare Jellyfin playback", error);
        this.api.core.osd("Jellyfin playback could not be prepared.");
        const failedLaunch = this.launch;
        if (failedLaunch !== void 0) {
          const generation = this.session.generation;
          this.session = reducePlaybackSession(this.session, {
            type: "fail",
            generation,
            positionTicks: this.session.positionTicks,
            message: "Jellyfin playback preparation failed."
          });
          const report = this.sendReport("stopped");
          try {
            this.publishState();
            this.api.mpv.set("stream-open-filename", "null://");
          } finally {
            this.cleanupPlaybackIfOwned(failedLaunch, generation);
          }
          await report;
        } else {
          this.clearMediaCredentials();
          this.deleteExternalSubtitle();
          this.scrubPlaybackSecrets();
          this.api.mpv.set("stream-open-filename", "null://");
        }
      } finally {
        next?.();
      }
    }
    async downloadExternalSubtitle(launch, loadSequence, generation) {
      const subtitle = launch.plan.externalSubtitle;
      if (subtitle === void 0) return;
      const extension = safeSubtitleExtension(subtitle.codec);
      const destination = `@tmp/jellyfin-subtitle-${safeTemporaryNameComponent(launch.nonce)}-${generation}-${loadSequence}.${extension}`;
      try {
        await this.transport.download(
          {
            method: "GET",
            url: subtitle.deliveryUrl,
            headers: launch.plan.headers
          },
          destination
        );
        const handle = this.api.file.handle(destination, "read");
        try {
          handle.seekToEnd();
          if (handle.offset() > MAX_EXTERNAL_SUBTITLE_BYTES) {
            throw new Error("The selected external subtitle exceeds the 10 MiB safety limit.");
          }
        } finally {
          handle.close();
        }
        if (loadSequence !== this.loadSequence || this.launch !== launch || this.session.generation !== generation) {
          throw new StalePlayerLoadError();
        }
        this.externalSubtitlePath = destination;
      } catch (error) {
        this.deleteSubtitlePath(destination);
        throw error;
      }
    }
    async mediaLoaded() {
      if (this.launch === void 0 || this.session.status !== "preparing") return;
      if (this.activeLoadReplacementSequence !== void 0 && this.activeLoadReplacementSequence !== this.replacementSequence) {
        return;
      }
      const generation = this.session.generation;
      this.clearUpNext(true);
      const requestedLocalStartSeconds = localStartPositionSeconds(this.launch.plan);
      const loadedLocalPositionSeconds = this.api.mpv.getNumber("time-pos");
      const shouldCorrectLoadedPosition = !Number.isFinite(loadedLocalPositionSeconds) || Math.abs(loadedLocalPositionSeconds - requestedLocalStartSeconds) > 1;
      if (shouldCorrectLoadedPosition) {
        this.api.core.seekTo(requestedLocalStartSeconds);
        this.logger.info("player.position.corrected", {
          correlation: this.launch.diagnosticCorrelation,
          resumed: this.launch.plan.startPositionTicks > 0
        });
      }
      this.applySelectedTracks();
      this.loadExternalSubtitleTrack();
      this.session = reducePlaybackSession(this.session, {
        type: "media-started",
        generation,
        // The initial mpv position can still describe stale watch-later state and
        // seekTo is asynchronous. Jellyfin's requested start is authoritative for
        // the start report; later progress reports use mpv's live position.
        positionTicks: this.launch.plan.startPositionTicks,
        durationTicks: this.readDurationTicks()
      });
      if (this.api.mpv.getFlag("pause")) {
        this.session = reducePlaybackSession(this.session, {
          type: "pause",
          generation,
          positionTicks: this.session.positionTicks
        });
      }
      this.logger.info("player.media.loaded", {
        correlation: this.launch.diagnosticCorrelation,
        playMethod: this.launch.plan.playMethod,
        resumed: this.launch.plan.startPositionTicks > 0
      });
      this.publishState();
      if (this.startedGeneration !== generation) {
        this.startedGeneration = generation;
        await this.sendReport("start");
      }
    }
    loadExternalSubtitleTrack() {
      const path = this.externalSubtitlePath;
      if (path === void 0) return;
      try {
        const resolved = this.api.utils.resolvePath(path);
        if (typeof resolved !== "string" || !resolved.startsWith("/")) {
          throw new Error("IINA could not resolve the plugin-private subtitle path.");
        }
        this.api.core.subtitle.loadTrack(resolved);
      } catch (error) {
        this.logger.warn("Could not attach the selected Jellyfin subtitle", error);
        this.api.core.osd("The selected subtitle could not be attached.");
        this.deleteExternalSubtitle();
      }
    }
    applySelectedTracks() {
      if (this.launch === void 0) return;
      const tracks = this.api.mpv.getNative("track-list") ?? [];
      const select = (type, streamIndex) => {
        if (streamIndex === void 0 || streamIndex < 0) {
          if (type === "sub" && streamIndex === -1) this.api.mpv.set("sid", "no");
          return;
        }
        const matched = tracks.find(
          (track) => track.type === type && (track["ff-index"] === streamIndex || track["ff-index"] === String(streamIndex))
        );
        if (matched?.id !== void 0) this.api.mpv.set(type === "audio" ? "aid" : "sid", matched.id);
      };
      select("audio", this.launch.plan.audioStreamIndex);
      select("sub", this.launch.plan.subtitleStreamIndex);
    }
    readPositionTicks() {
      if (this.launch === void 0) return 0;
      const seconds = this.api.mpv.getNumber("time-pos");
      if (!Number.isFinite(seconds) || seconds < 0) {
        return clampPositionTicks(this.session.positionTicks, this.launch.plan.runtimeTicks);
      }
      const relative = secondsToTicks(seconds);
      return clampPositionTicks(this.positionBaseTicks + relative, this.launch.plan.runtimeTicks);
    }
    handleEndFile() {
      const acknowledge = this.pendingCoreStopAcknowledgement;
      if (acknowledge !== void 0) {
        this.pendingCoreStopAcknowledgement = void 0;
        acknowledge();
        return;
      }
      if (this.replacementEndFilesToIgnore > 0) {
        this.replacementEndFilesToIgnore -= 1;
        return;
      }
      void this.ended();
    }
    readDurationTicks() {
      if (this.launch?.plan.runtimeTicks !== void 0) return this.launch.plan.runtimeTicks;
      const seconds = this.api.mpv.getNumber("duration");
      return Number.isFinite(seconds) && seconds >= 0 ? secondsToTicks(seconds) : void 0;
    }
    updatePosition() {
      if (this.launch === void 0) return;
      const update = {
        type: "time-update",
        generation: this.session.generation,
        positionTicks: this.readPositionTicks()
      };
      const duration = this.readDurationTicks();
      if (duration !== void 0) update.durationTicks = duration;
      this.session = reducePlaybackSession(this.session, update);
    }
    async pauseChanged() {
      if (this.launch === void 0 || this.session.status !== "playing" && this.session.status !== "paused") {
        return;
      }
      this.updatePosition();
      const paused = this.api.mpv.getFlag("pause");
      this.session = reducePlaybackSession(this.session, {
        type: paused ? "pause" : "resume",
        generation: this.session.generation,
        positionTicks: this.session.positionTicks
      });
      this.publishState();
      await this.sendReport("progress", paused ? "pause" : "unpause");
    }
    async reportImmediate(eventName) {
      if (this.launch === void 0 || this.session.status !== "playing" && this.session.status !== "paused") {
        return;
      }
      this.updatePosition();
      this.session = reducePlaybackSession(this.session, {
        type: "seek",
        generation: this.session.generation,
        positionTicks: this.session.positionTicks
      });
      this.publishState();
      await this.sendReport("progress", eventName);
    }
    playbackTimingChanged() {
      if (this.launch === void 0 || this.session.status !== "playing" && this.session.status !== "paused") {
        return;
      }
      this.updatePosition();
      this.publishState();
    }
    async periodicProgress() {
      if (this.launch !== void 0 && (this.session.status === "preparing" || this.session.status === "paused")) {
        if (this.session.status === "paused") this.updatePosition();
        this.publishState();
        return;
      }
      if (!shouldReportPeriodicProgress(this.session, Date.now(), DEFAULT_PROGRESS_INTERVAL_MS))
        return;
      this.updatePosition();
      this.publishState();
      await this.sendReport("progress", "timeupdate");
    }
    async sendReport(kind, eventName) {
      const launch = this.launch;
      if (launch === void 0) return;
      const stateAtSend = {
        ...this.session,
        ...this.session.plan === void 0 ? {} : { plan: { ...this.session.plan } }
      };
      const contextAtSend = { ...launch.context };
      const telemetry = {
        canSeek: this.api.mpv.getFlag("seekable"),
        isMuted: this.api.mpv.getFlag("mute"),
        volumeLevel: this.api.mpv.getNumber("volume"),
        failed: stateAtSend.status === "error"
      };
      if (eventName !== void 0) telemetry.eventName = eventName;
      const report = async () => {
        try {
          const request = buildPlaybackReportRequest(kind, stateAtSend, contextAtSend, telemetry);
          await this.transport.execute(request);
          if (kind === "progress" && this.session.generation === stateAtSend.generation) {
            this.session = reducePlaybackSession(this.session, {
              type: "progress-reported",
              generation: stateAtSend.generation,
              atMs: Date.now()
            });
          }
        } catch (error) {
          this.logger.warn(`Jellyfin playback ${kind} report failed`, error);
        }
      };
      const queued = this.reportQueue.then(report, report);
      this.reportQueue = queued;
      await queued;
    }
    async ended() {
      if (this.launch === void 0) return;
      if (this.session.status !== "preparing" && this.session.status !== "playing" && this.session.status !== "paused") {
        return;
      }
      const launch = this.launch;
      this.updatePosition();
      const generation = this.session.generation;
      if (this.session.status === "preparing") {
        this.session = reducePlaybackSession(this.session, {
          type: "fail",
          generation,
          positionTicks: this.session.positionTicks,
          message: "The Jellyfin media ended before IINA could load it."
        });
        const report2 = this.sendReport("stopped");
        try {
          this.publishState();
        } finally {
          this.cleanupPlaybackIfOwned(launch, generation);
        }
        await report2;
        return;
      }
      const duration = this.session.durationTicks;
      const completed = duration !== void 0 && duration > 0 && this.session.positionTicks >= duration - secondsToTicks(2);
      this.session = completed ? reducePlaybackSession(this.session, {
        type: "complete",
        generation,
        positionTicks: this.session.positionTicks
      }) : reducePlaybackSession(this.session, {
        type: "stop",
        generation,
        positionTicks: this.session.positionTicks,
        reason: "user"
      });
      this.logger.info("player.media.ended", {
        correlation: this.launch.diagnosticCorrelation,
        completed
      });
      const report = this.sendReport("stopped");
      try {
        this.publishState();
      } finally {
        this.cleanupPlaybackIfOwned(launch, generation);
      }
      await report;
    }
    async stop(reason, closing) {
      this.discardPendingHandoffs();
      if (this.launch === void 0) {
        this.clearMediaCredentials();
        this.deleteExternalSubtitle();
        if (!closing) await this.stopCoreAndWaitForEnd();
        return;
      }
      const launch = this.launch;
      this.updatePosition();
      const generation = this.session.generation;
      const wasActive = this.session.status === "preparing" || this.session.status === "playing" || this.session.status === "paused";
      this.logger.info("player.stop.requested", {
        correlation: this.launch.diagnosticCorrelation,
        reason,
        closing,
        wasActive
      });
      this.session = reducePlaybackSession(this.session, {
        type: "stop",
        generation,
        positionTicks: this.session.positionTicks,
        reason
      });
      let endAcknowledgement;
      if (!closing) {
        endAcknowledgement = this.stopCoreAndWaitForEnd();
      }
      const report = wasActive ? this.sendReport("stopped") : void 0;
      try {
        this.publishState();
      } finally {
        this.cleanupPlaybackIfOwned(launch, generation);
      }
      if (report !== void 0) await report;
      if (endAcknowledgement !== void 0) await endAcknowledgement;
    }
    releaseForExternalLoad() {
      const launch = this.launch;
      const generation = this.session.generation;
      let report;
      try {
        if (launch !== void 0) {
          this.updatePosition();
          const wasActive = this.session.status === "preparing" || this.session.status === "playing" || this.session.status === "paused";
          if (wasActive) {
            this.session = reducePlaybackSession(this.session, {
              type: "stop",
              generation,
              positionTicks: this.session.positionTicks,
              reason: "replaced"
            });
            report = this.sendReport("stopped");
            this.publishState();
          }
        }
      } finally {
        this.clearUpNext(true);
        if (launch !== void 0) this.cleanupPlaybackIfOwned(launch, generation);
      }
      if (report !== void 0) {
        void report.catch((error) => {
          this.logger.warn("Jellyfin playback stopped report failed during an external load", error);
        });
      }
      return Promise.resolve();
    }
    clearMediaCredentials() {
      this.api.mpv.set("http-header-fields", []);
    }
    deleteExternalSubtitle() {
      const path = this.externalSubtitlePath;
      this.externalSubtitlePath = void 0;
      if (path === void 0) return;
      this.deleteSubtitlePath(path);
    }
    deleteSubtitlePath(path) {
      try {
        if (this.api.file.exists(path)) this.api.file.delete(path);
      } catch (error) {
        this.logger.warn("Could not remove a temporary Jellyfin subtitle", error);
      }
    }
    stopCoreAndWaitForEnd() {
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (this.pendingCoreStopAcknowledgement === finish) {
            this.pendingCoreStopAcknowledgement = void 0;
          }
          resolve();
        };
        const timer = setTimeout(finish, CORE_STOP_ACK_TIMEOUT_MS);
        this.pendingCoreStopAcknowledgement = finish;
        try {
          this.api.core.stop();
        } catch {
          finish();
        }
      });
    }
    enqueueControl(task) {
      const run = async () => {
        try {
          await task();
        } catch (error) {
          this.logger.warn("Jellyfin player control failed", error);
        }
      };
      const queued = this.controlQueue.then(run, run);
      this.controlQueue = queued;
    }
    beginLoad() {
      this.invalidatePendingLoads();
      return this.loadSequence;
    }
    invalidatePendingLoads() {
      this.loadSequence += 1;
    }
    discardPendingHandoffs() {
      this.pendingLaunchesForHook.length = 0;
    }
    ensureProgressTimer() {
      if (this.progressTimer !== void 0) return;
      this.progressTimer = setInterval(
        () => void this.periodicProgress(),
        DEFAULT_PROGRESS_INTERVAL_MS
      );
    }
    clearProgressTimer() {
      if (this.progressTimer === void 0) return;
      clearInterval(this.progressTimer);
      this.progressTimer = void 0;
    }
    cleanupPlaybackIfOwned(launch, generation) {
      if (this.launch !== launch || this.session.generation !== generation) return;
      try {
        this.clearMediaCredentials();
      } finally {
        this.deleteExternalSubtitle();
        this.scrubPlaybackSecrets();
      }
    }
    scrubPlaybackSecrets() {
      const current = this.session;
      const scrubbed = {
        generation: current.generation,
        status: current.status,
        positionTicks: current.positionTicks
      };
      if (current.durationTicks !== void 0) scrubbed.durationTicks = current.durationTicks;
      if (current.lastProgressReportAtMs !== void 0) {
        scrubbed.lastProgressReportAtMs = current.lastProgressReportAtMs;
      }
      if (current.stopReason !== void 0) scrubbed.stopReason = current.stopReason;
      if (current.errorMessage !== void 0) scrubbed.errorMessage = current.errorMessage;
      this.session = scrubbed;
      this.launch = void 0;
      this.activeLoadReplacementSequence = void 0;
    }
    async replace(launch, sequence) {
      if (sequence !== this.replacementSequence) return;
      this.clearUpNext(true);
      const coreWasIdle = this.api.core.status.idle;
      const hadActiveMedia = this.retireForReplacement();
      if (sequence !== this.replacementSequence) return;
      const replaceInsideMpv = hadActiveMedia || !coreWasIdle;
      if (replaceInsideMpv) this.replacementEndFilesToIgnore += 1;
      const pending = { launch, replacementSequence: sequence };
      this.pendingLaunchesForHook.push(pending);
      try {
        if (replaceInsideMpv) {
          this.api.mpv.command("loadfile", ["null://", "replace"]);
        } else {
          this.api.core.open("null://");
        }
      } catch (error) {
        const pendingIndex = this.pendingLaunchesForHook.indexOf(pending);
        if (pendingIndex >= 0) this.pendingLaunchesForHook.splice(pendingIndex, 1);
        if (replaceInsideMpv) this.replacementEndFilesToIgnore -= 1;
        throw error;
      }
    }
    retireForReplacement() {
      const launch = this.launch;
      if (launch === void 0) {
        this.clearMediaCredentials();
        this.deleteExternalSubtitle();
        return false;
      }
      this.updatePosition();
      const generation = this.session.generation;
      const wasActive = this.session.status === "preparing" || this.session.status === "playing" || this.session.status === "paused";
      this.session = reducePlaybackSession(this.session, {
        type: "stop",
        generation,
        positionTicks: this.session.positionTicks,
        reason: "replaced"
      });
      const report = wasActive ? this.sendReport("stopped") : void 0;
      try {
        this.publishState();
      } finally {
        this.cleanupPlaybackIfOwned(launch, generation);
      }
      if (report !== void 0) {
        void report.catch((error) => {
          this.logger.warn("Jellyfin playback stopped report failed during replacement", error);
        });
      }
      return wasActive;
    }
    publishState() {
      const display = this.launch?.display;
      const state = {
        generation: this.session.generation,
        status: this.session.status,
        positionTicks: this.session.positionTicks,
        durationTicks: this.session.durationTicks,
        title: display?.title,
        seriesName: display?.seriesName,
        seasonNumber: display?.seasonNumber,
        episodeNumber: display?.episodeNumber,
        playMethod: this.launch?.plan.playMethod,
        itemId: this.launch?.plan.itemId,
        stopReason: this.session.stopReason
      };
      if (this.sidebarReady) this.api.sidebar.postMessage("player.state", state);
      if (this.overlayReady) this.api.overlay.postMessage("player.state", state);
      this.persistPublicPlaybackState();
    }
    persistPublicPlaybackState() {
      const launch = this.launch;
      if (launch === void 0 || this.session.status === "idle") return;
      const state = {
        version: 1,
        playbackId: launch.nonce,
        sequence: ++this.playbackStateSequence,
        generation: this.session.generation,
        status: this.session.status,
        itemId: launch.plan.itemId,
        positionTicks: this.session.positionTicks,
        title: launch.display.title,
        playMethod: launch.plan.playMethod,
        startedAtMs: this.playbackStartedAtMs,
        updatedAtMs: Date.now(),
        isBuffering: this.api.mpv.getFlag("paused-for-cache")
      };
      const playbackRate = this.api.mpv.getNumber("speed");
      if (Number.isFinite(playbackRate) && playbackRate >= 0.01 && playbackRate <= 100) {
        state.playbackRate = playbackRate;
      }
      if (this.session.durationTicks !== void 0) state.durationTicks = this.session.durationTicks;
      if (launch.display.seriesName !== void 0) state.seriesName = launch.display.seriesName;
      if (launch.display.seasonNumber !== void 0) {
        state.seasonNumber = launch.display.seasonNumber;
      }
      if (launch.display.episodeNumber !== void 0) {
        state.episodeNumber = launch.display.episodeNumber;
      }
      if (this.session.stopReason !== void 0) state.stopReason = this.session.stopReason;
      try {
        writePlaybackState(this.api.file, state);
        this.playbackStatePersistenceFailed = false;
      } catch (error) {
        if (this.playbackStatePersistenceFailed) return;
        this.playbackStatePersistenceFailed = true;
        this.logger.warn("Could not publish playback state to the Jellyfin catalog", error);
      }
    }
    receiveUpNext(raw) {
      if (raw === null || typeof raw !== "object") return;
      const candidate = raw;
      const item = BaseItemSchema.safeParse(candidate.item);
      if (!item.success) return;
      const countdownSeconds = typeof candidate.countdownSeconds === "number" && candidate.countdownSeconds >= 1 ? Math.min(60, Math.floor(candidate.countdownSeconds)) : 10;
      const next = {
        itemId: item.data.Id,
        title: item.data.Name,
        remainingSeconds: countdownSeconds,
        autoplay: candidate.autoplay === true
      };
      if (item.data.SeriesName != null) next.seriesName = item.data.SeriesName;
      if (item.data.ParentIndexNumber != null) next.seasonNumber = item.data.ParentIndexNumber;
      if (item.data.IndexNumber != null) next.episodeNumber = item.data.IndexNumber;
      this.upNext = next;
      this.publishUpNext();
      if (this.overlayReady) this.api.overlay.show();
      this.updateUpNextTimer();
    }
    updateUpNextTimer() {
      if (this.upNextTimer !== void 0) clearInterval(this.upNextTimer);
      this.upNextTimer = void 0;
      if (this.upNext?.autoplay !== true) return;
      this.upNextTimer = setInterval(() => {
        if (this.upNext === void 0 || !this.upNext.autoplay) return;
        this.upNext.remainingSeconds -= 1;
        if (this.upNext.remainingSeconds <= 0) {
          const itemId = this.upNext.itemId;
          this.clearUpNext(true);
          this.api.global.postMessage(PLAYER_MESSAGES.playNext, { itemId });
          return;
        }
        this.publishUpNext();
      }, 1e3);
    }
    publishUpNext() {
      if (this.upNext === void 0) return;
      if (this.sidebarReady) this.api.sidebar.postMessage("player.upNext", this.upNext);
      if (this.overlayReady) this.api.overlay.postMessage("player.upNext", this.upNext);
    }
    clearUpNext(hideOverlay) {
      if (this.upNextTimer !== void 0) clearInterval(this.upNextTimer);
      this.upNextTimer = void 0;
      this.upNext = void 0;
      if (this.sidebarReady) this.api.sidebar.postMessage("player.upNext", null);
      if (this.overlayReady) {
        this.api.overlay.postMessage("player.upNext", null);
        if (hideOverlay) this.api.overlay.hide();
      }
    }
    loadPlayerViews() {
      this.api.sidebar.loadFile("dist/ui/sidebar/index.html");
      this.sidebarReady = true;
      this.api.overlay.loadFile("dist/ui/overlay/index.html");
      this.api.overlay.setClickable(true);
      this.overlayReady = true;
      this.publishState();
    }
    handleViewAction(raw, source) {
      if (raw === null || typeof raw !== "object") return;
      const action = raw.action;
      if (action === "host.ready") {
        this.publishState();
        this.publishUpNext();
      } else if (action === "window.openCatalog") {
        this.api.preferences.set(CATALOG_OPEN_REQUEST_PREFERENCE_KEY, Date.now());
        this.api.preferences.sync();
      } else if (action === "settings.autoplay") {
        const enabled = raw.enabled;
        if (typeof enabled === "boolean") {
          this.api.preferences.set("autoplayNextEpisode", enabled);
          this.api.preferences.sync();
          if (this.upNext !== void 0) {
            this.upNext.autoplay = enabled;
            this.updateUpNextTimer();
            this.publishUpNext();
          }
        }
      } else if (action === "player.pause") {
        this.api.core.pause();
      } else if (action === "player.resume") {
        this.api.core.resume();
      } else if (action === "upNext.cancel") {
        this.clearUpNext(true);
      } else if (action === "upNext.playNow" && this.upNext !== void 0) {
        const itemId = this.upNext.itemId;
        this.clearUpNext(true);
        this.api.global.postMessage(PLAYER_MESSAGES.playNext, { itemId });
      }
      const view = source === "sidebar" ? this.api.sidebar : this.api.overlay;
      view.postMessage("host.response", { action, ok: true });
    }
  };

  // packages/plugin/src/safe-logger.ts
  var MAX_SERIALIZED_CONTEXT_CHARS = 16 * 1024;
  var MAX_LOG_MESSAGE_CHARS = 4 * 1024;
  var MAX_COLLECTION_ENTRIES = 100;
  var MAX_CONTEXT_DEPTH = 8;
  function scrubLocalPaths2(value) {
    return value.replace(/\/Users\/[^/\s"']+/g, "~");
  }
  function sanitizeMessage(message) {
    const sanitized = scrubLocalPaths2(redactString(message));
    if (sanitized.length <= MAX_LOG_MESSAGE_CHARS) return sanitized;
    return `${sanitized.slice(0, MAX_LOG_MESSAGE_CHARS)}…[TRUNCATED]`;
  }
  function normalizeLogValue(value, seen = /* @__PURE__ */ new WeakSet(), depth = 0) {
    if (typeof value === "string") return scrubLocalPaths2(value);
    if (value === null || typeof value !== "object") return value;
    if (depth >= MAX_CONTEXT_DEPTH) return "[MAX_DEPTH]";
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) {
      const candidate = value;
      const normalized = {
        name: candidate.name,
        message: candidate.message
      };
      if (typeof candidate.code === "string" || typeof candidate.code === "number") {
        normalized.code = candidate.code;
      }
      if (typeof candidate.stack === "string") normalized.stack = scrubLocalPaths2(candidate.stack);
      if (candidate.cause !== void 0) {
        normalized.cause = normalizeLogValue(candidate.cause, seen, depth + 1);
      }
      return normalized;
    }
    if (Array.isArray(value)) {
      return value.slice(0, MAX_COLLECTION_ENTRIES).map((item) => normalizeLogValue(item, seen, depth + 1));
    }
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_COLLECTION_ENTRIES)) {
      output[key] = normalizeLogValue(item, seen, depth + 1);
    }
    return output;
  }
  function serialize(value) {
    if (typeof value === "string") return scrubLocalPaths2(redactString(value));
    try {
      const serialized = JSON.stringify(redactSecrets(normalizeLogValue(value)));
      if (serialized.length <= MAX_SERIALIZED_CONTEXT_CHARS) return serialized;
      return `${serialized.slice(0, MAX_SERIALIZED_CONTEXT_CHARS)}…[TRUNCATED]`;
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
      const safeMessage = sanitizeMessage(message);
      this.sink.log(context === void 0 ? safeMessage : `${safeMessage} ${serialize(context)}`);
    }
    warn(message, context) {
      const safeMessage = sanitizeMessage(message);
      this.sink.warn(context === void 0 ? safeMessage : `${safeMessage} ${serialize(context)}`);
    }
    error(message, context) {
      const safeMessage = sanitizeMessage(message);
      this.sink.error(context === void 0 ? safeMessage : `${safeMessage} ${serialize(context)}`);
    }
  };

  // packages/plugin/src/index.ts
  var api = iina;
  var diagnosticPaths = createPlayerDiagnosticLogPaths(createOpaqueId("player"));
  var diagnostics = new PersistentDiagnosticLog(
    api.file,
    () => void 0,
    Date.now,
    MAX_DIAGNOSTIC_LOG_BYTES,
    diagnosticPaths
  );
  var logger = new SafeLogger(
    createPlayerDiagnosticSink(api.console, (record) => {
      diagnostics.append(record.level, "player", record.message);
    })
  );
  var runtime = new PlayerRuntime(api, new IinaHttpTransport(api.http), logger);
  runtime.install();
  logger.info("Jellyfin player integration ready");
  prunePlayerDiagnosticLogs(api.file, diagnosticPaths.generationId);
})();
//# sourceMappingURL=index.js.map
