export default function CctvTestPage() {
    const testUrl = "https://coast.mof.go.kr/serviceGateway.jsp?http://10.176.62.134:9001/tilemapApi.do?url=http://220.95.232.18:8080/img/52_0.jpg?" + Date.now();
  
    return (
      <div style={{ padding: 20 }}>
        <h1>CCTV 임베드 테스트</h1>
        <p>아래 이미지가 뜨면 성공, 안 뜨면(깨진 이미지 아이콘) Referer 차단입니다.</p>
        <img src={testUrl} alt="경포 CCTV 테스트" style={{ maxWidth: "100%" }} />
      </div>
    );
  }