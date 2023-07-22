
CREATE TABLE `content` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `title` varchar(255) NOT NULL DEFAULT '',
  `alias` varchar(255) UNIQUE,
  `introtext` mediumtext NOT NULL,
  `fulltext` mediumtext NOT NULL,
  `catid` int(11) NOT NULL DEFAULT '0',
  `created` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `metakey` text NOT NULL COLLATE NOCASE
);
INSERT INTO content VALUES (1, 'Lorem Ipsor factor', 'lorem_ipsor', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit', 'sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.', 1,'2023-07-22T00:00:00.000Z','latin,rubbish');