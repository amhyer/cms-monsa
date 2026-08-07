<?php
require_once __DIR__ . '/src/DapodikClient.php';
$config = require 'config.php';

$client = new DapodikClient(
    $config['npsn'],
    $config['token'],
    $config['host'],
    $config['port'],
    $config['protocol'] ?? 'http'
);

if ($client->testConnection()) {
    echo "Koneksi berhasil!\n";
    $data = $client->getAllData();
    print_r($data['sekolah']);
} else {
    echo "Gagal koneksi!\n";
}
