<?php
require_once __DIR__ . '/src/DapodikClient.php';

echo "Test 1: Protocol default (http)... ";

// Create client with dummy values, test URL construction via reflection
$ref = new ReflectionClass(DapodikClient::class);
$client = $ref->newInstanceWithoutConstructor();

// Set properties via reflection
foreach (['npsn', 'token', 'protocol', 'baseUrl'] as $prop) {
    $r = new ReflectionProperty(DapodikClient::class, $prop);
    $r->setAccessible(true);
}

$r = new ReflectionProperty(DapodikClient::class, 'npsn');
$r->setValue($client, '12345678');

$r = new ReflectionProperty(DapodikClient::class, 'token');
$r->setValue($client, 'test-token');

$r = new ReflectionProperty(DapodikClient::class, 'protocol');
$r->setValue($client, 'http');

$r = new ReflectionProperty(DapodikClient::class, 'baseUrl');
$r->setValue($client, 'http://localhost:5774/WebService');

$r = new ReflectionProperty(DapodikClient::class, 'baseUrl');
$base = $r->getValue($client);
assert(str_starts_with($base, 'http://'), "Should be http://");
assert(!str_starts_with($base, 'https://'), "Should NOT be https://");
echo "PASS ({$base})\n";

echo "Test 2: Protocol https... ";

$r = new ReflectionProperty(DapodikClient::class, 'protocol');
$r->setValue($client, 'https');

$r = new ReflectionProperty(DapodikClient::class, 'baseUrl');
$r->setValue($client, 'https://localhost:5774/WebService');

$r = new ReflectionProperty(DapodikClient::class, 'baseUrl');
$base2 = $r->getValue($client);
assert(str_starts_with($base2, 'https://'), "Should be https://");
echo "PASS ({$base2})\n";

echo "\nAll protocol tests passed!\n";
