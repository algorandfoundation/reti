import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle } from 'lucide-react'
import { Meta } from '@/components/Meta'
import { PageHeader } from '@/components/PageHeader'
import { PageMain } from '@/components/PageMain'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/institutional-support')({
  component: InstitutionalSupport,
})

function InstitutionalSupport() {
  return (
    <>
      <Meta title="Institutional Support" />
      <PageHeader
        title="Institutional Support"
        description="White-glove support for institutional validators"
        separator
      />
      <PageMain>
        <div className="space-y-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Onboarding Support */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Onboarding Support</CardTitle>
                <CardDescription>
                  Get started with expert guidance and personalized setup assistance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg">Features</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Onboarding call</div>
                          <div className="text-sm text-muted-foreground">
                            1-hour walkthrough of protocol & node daemon
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Configuration assistance</div>
                          <div className="text-sm text-muted-foreground">
                            Personalized recommendations & optimizations for pool / node setup
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Monitoring</div>
                          <div className="text-sm text-muted-foreground">
                            Assistance setting up monitoring
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t">
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Pricing
                    </div>
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-semibold">One-time Setup</div>
                          <div className="text-sm text-muted-foreground">
                            Complete onboarding package
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">$499</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ongoing Support */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Ongoing Support</CardTitle>
                <CardDescription>
                  Continuous support and guidance for your staking operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg">Features</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">
                            Private support channel (Slack / Discord)
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Response within 8 hours
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Managing pools & configurations</div>
                          <div className="text-sm text-muted-foreground">
                            Ongoing guidance managing pools
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Network / protocol upgrades</div>
                          <div className="text-sm text-muted-foreground">
                            Custom guidance for any network or protocol changes
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t">
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Pricing
                    </div>
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-lg font-semibold">Monthly</div>
                            <div className="text-sm text-muted-foreground">Billed monthly</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">$499</div>
                            <div className="text-sm text-muted-foreground">/month</div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-lg font-semibold">Annual</div>
                            <div className="text-sm text-muted-foreground">
                              $416/month when billed annually
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">$4,999</div>
                            <div className="text-sm text-muted-foreground">/year</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Managed Service */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Managed Service</CardTitle>
                <CardDescription>
                  Complete hands-off staking solution with dedicated infrastructure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg">Features</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Onboarding call</div>
                          <div className="text-sm text-muted-foreground">
                            1-hour video call to walk through desired configuration
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Dedicated node VM</div>
                          <div className="text-sm text-muted-foreground">
                            99.95% uptime guarantee with enterprise infrastructure
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Dashboard with monitoring</div>
                          <div className="text-sm text-muted-foreground">
                            Real-time insights and alerts for your staking operations
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Enterprise security</div>
                          <div className="text-sm text-muted-foreground">
                            Hands-off management without introducing custody risk
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">
                            Private support channel (Slack / Discord)
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Response within 8 hours
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Managing pools & configurations</div>
                          <div className="text-sm text-muted-foreground">
                            Full management of pools and configurations
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Zero downtime upgrades</div>
                          <div className="text-sm text-muted-foreground">
                            Seamless updates without interrupting staking operations
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t">
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Pricing
                    </div>
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-lg font-semibold">Monthly</div>
                            <div className="text-sm text-muted-foreground">Billed monthly</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">$799</div>
                            <div className="text-sm text-muted-foreground">/month</div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-lg font-semibold">Annual</div>
                            <div className="text-sm text-muted-foreground">
                              $666/month when billed annually
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">$7,999</div>
                            <div className="text-sm text-muted-foreground">/year</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Contact us to discuss your requirements and schedule a consultation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Email</div>
                    <a
                      href="mailto:reti@txnlab.dev?subject=Reti%20Institutional%20Support"
                      className="font-semibold hover:text-primary transition-colors"
                    >
                      reti@txnlab.dev
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Response Time</div>
                    <div className="font-semibold">Within 24 hours</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageMain>
    </>
  )
}
