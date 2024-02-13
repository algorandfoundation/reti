/*
 * NFD Management Service
 *
 * Service for querying and managing NFDs
 *
 * API version: 1.0
 * Contact: feedback@txnlab.dev
 * Generated by: Swagger Codegen (https://github.com/swagger-api/swagger-codegen.git)
 */
package swagger

type TotalsOkResponseBody struct {
	ForSale int32 `json:"forSale"`
	// Not returned, used in tagging for response to indicate if-none-match etag matched
	MatchCheck    string                             `json:"match-check,omitempty"`
	MintedTotals  *TotalsOkResponseBodyMintedTotals  `json:"mintedTotals"`
	SegmentTotals *TotalsOkResponseBodySegmentTotals `json:"segmentTotals"`
	SoldTotals    *TotalsOkResponseBodySoldTotals    `json:"soldTotals"`
	Total         int32                              `json:"total"`
	TotalSegments int32                              `json:"totalSegments"`
	UniqueOwners  int32                              `json:"uniqueOwners"`
}