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

// Data to use as part of verification
type VerifyRequestResponseBody struct {
	// Challenge to be used as part of verification process, with use specific to each field
	Challenge string `json:"challenge"`
	// ID of challenge, must be used in subsequent confirmation call but may be blank
	Id string `json:"id"`
	// If set, no confirmation is required, the verify call was sufficient
	Validated bool `json:"validated,omitempty"`
}