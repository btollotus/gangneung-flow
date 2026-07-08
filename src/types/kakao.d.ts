export {}

declare global {
  interface Window {
    Kakao: {
      init: (key: string) => void
      isInitialized: () => boolean
      Share: {
        sendDefault: (options: {
          objectType: 'text' | 'feed' | 'list' | 'location' | 'commerce'
          text?: string
          content?: Record<string, unknown>
          link?: {
            mobileWebUrl?: string
            webUrl?: string
          }
          buttons?: Array<{
            title: string
            link: { mobileWebUrl?: string; webUrl?: string }
          }>
        }) => void
      }
      Navi: {
        start: (options: {
          name: string
          x: number
          y: number
          coordType: 'wgs84'
        }) => void
      }
    }
  }
}