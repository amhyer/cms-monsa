<?php
/**
 * Mock test for Fase 1 — testConnection() + basic functionality.
 * Run: php test-mock.php
 */

require_once __DIR__ . '/src/DapodikClient.php';

class MockDapodikClient extends DapodikClient
{
    private bool $shouldFail;

    public function __construct(bool $shouldFail = false)
    {
        // No real connection needed
        $this->shouldFail = $shouldFail;
    }

    // Override constructor storage to avoid parent calling real request
    public static function create(bool $shouldFail = false): self
    {
        $client = new self($shouldFail);
        return $client;
    }

    // We can't override private request() easily, so test via reflection
}

// Test 1: testConnection() returns true on successful getSekolah()
echo "Test 1: testConnection() with successful response... ";

// Use a mock subclass that overrides getSekolah to return dummy data
class TestableDapodikClient extends DapodikClient
{
    public function __construct() {}

    public function getSekolah(): array
    {
        return ['nama' => 'SDN Test', 'npsn' => '12345678'];
    }
}

$client = new TestableDapodikClient();
$result = $client->testConnection();
assert($result === true, "testConnection() should return true");
echo "PASS\n";

// Test 2: testConnection() returns false on exception
echo "Test 2: testConnection() with exception... ";

class FailingDapodikClient extends DapodikClient
{
    public function __construct() {}

    public function getSekolah(): array
    {
        throw new Exception("Connection refused");
    }
}

$client2 = new FailingDapodikClient();
$result2 = $client2->testConnection();
assert($result2 === false, "testConnection() should return false on exception");
echo "PASS\n";

echo "\nAll mock tests passed!\n";
