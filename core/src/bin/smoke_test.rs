use anyhow::Result;
use flick_core::{incoming_receiver, send_flick, start_node};
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() -> Result<()> {
    println!("🧪 [smoke_test] Starting Flick Core Smoke Test (2 Nodes)...");

    // Start Node 1 (Receiver Node)
    let receiver_node_id = start_node("SmokeReceiverNode".to_string())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to start receiver node: {}", e))?;
    println!("✅ Node 1 (Receiver) initialized: {}", receiver_node_id);

    // Subscribe to incoming flicks
    let mut rx = incoming_receiver();

    // Start Node 2 (Sender Node)
    let sender_node_id = start_node("SmokeSenderNode".to_string())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to start sender node: {}", e))?;
    println!("✅ Node 2 (Sender) initialized: {}", sender_node_id);

    println!("⏳ Waiting 1.5s for gossip network join...");
    sleep(Duration::from_millis(1500)).await;

    let test_content = "https://github.com/madhanio/flick/smoke-test-payload-pass-99".to_string();
    let dev_sender = format!("dev_{}", &sender_node_id[..8.min(sender_node_id.len())]);

    println!("📤 Node 2 sending flick: \"{}\"", test_content);
    send_flick(test_content.clone(), dev_sender, "SmokeSenderNode".to_string())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to send flick: {}", e))?;

    println!("📥 Waiting for receiver node to capture flick payload...");
    match tokio::time::timeout(Duration::from_secs(12), rx.recv()).await {
        Ok(Ok(payload)) => {
            println!("\n🎉 SMOKE TEST PASSED!");
            println!("   Type: {}", payload.msg_type);
            println!("   Content: {}", payload.content);
            println!("   Preview: {}", payload.preview);
            println!("   From Device Name: {}", payload.from_device_name);
            println!("   From Device ID: {}", payload.from_device_id);
            println!("   Timestamp: {}", payload.ts);
            assert_eq!(payload.content, test_content);
        }
        Ok(Err(e)) => {
            panic!("❌ Receiver channel error: {:?}", e);
        }
        Err(_) => {
            panic!("❌ Smoke test timed out waiting for incoming flick!");
        }
    }

    Ok(())
}
